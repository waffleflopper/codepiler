import * as esbuild from "esbuild-wasm";
import axios from "axios";
import localforage from "localforage";

const fileCache = localforage.createInstance({
  name: "filecache",
});

export const fetchPlugin = (inputCode: string) => {
  return {
    name: "fetch-plugin",
    setup(build: esbuild.PluginBuild) {
      //onload
      build.onLoad({ filter: /.*/ }, async (args: any) => {
        if (args.path === "index.js") {
          return {
            loader: "jsx",
            contents: inputCode,
          };
        }

        //have we fetched this file?
        const cachedResult = await fileCache.getItem<esbuild.OnLoadResult>(
          args.path
        );
        //is it in cache?
        if (cachedResult) {
          return cachedResult;
        }

        //fetching from unpkg.com
        const { data, request } = await axios.get(args.path);

        // do a .match .css$ to determine if we need to use css loader
        const filetype = args.path.match(/.css$/) ? "css" : "jsx";

        const escaped = data
          .replace(/\n/g, "")
          .replace(/"/g, '\\"')
          .replace(/'/g, "\\'");
        const contents =
          filetype === "css" //can't directly import a css file, so we'll grab the css and plop it in some js
            ? `
          const style = document.createElement('style');
          style.innerText = '${escaped}';
          document.head.appendChild(style);
        `
            : data;

        const result: esbuild.OnLoadResult = {
          loader: "jsx", //can't use css here or esbuild gets mad since we don't write to files
          contents,
          resolveDir: new URL("./", request.responseURL).pathname, //ensures packages nested in directories are properly resolved
        };

        //cache it
        await fileCache.setItem(args.path, result);

        return result;
      });
    },
  };
};
