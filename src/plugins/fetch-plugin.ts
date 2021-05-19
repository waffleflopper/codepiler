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
      build.onLoad({ filter: /(^index\.js$)/ }, () => {
        return {
          loader: "jsx",
          contents: inputCode,
        };
      });

      build.onLoad({ filter: /.*/ }, async (args: any) => {
        // will run for every file, but since it doesn't return anything
        // esbuilt will go onto other onLoads that match the filter
        // makes it good for checking cache
        const cachedResult = await fileCache.getItem<esbuild.OnLoadResult>(
          args.path
        );
        //is it in cache?
        if (cachedResult) {
          return cachedResult;
        }

        return null;
      });

      build.onLoad({ filter: /.css$/ }, async (args: any) => {
        //fetching from unpkg.com
        const { data, request } = await axios.get(args.path);

        const escaped = data
          .replace(/\n/g, "")
          .replace(/"/g, '\\"')
          .replace(/'/g, "\\'");
        const contents = `
          const style = document.createElement('style');
          style.innerText = '${escaped}';
          document.head.appendChild(style);
        `;

        const result: esbuild.OnLoadResult = {
          loader: "jsx", //can't use css here or esbuild gets mad since we don't write to files
          contents,
          resolveDir: new URL("./", request.responseURL).pathname, //ensures packages nested in directories are properly resolved
        };

        //cache it
        await fileCache.setItem(args.path, result);

        return result;
      });

      //onload
      build.onLoad({ filter: /.*/ }, async (args: any) => {
        //fetching from unpkg.com
        const { data, request } = await axios.get(args.path);

        const result: esbuild.OnLoadResult = {
          loader: "jsx", //can't use css here or esbuild gets mad since we don't write to files
          contents: data,
          resolveDir: new URL("./", request.responseURL).pathname, //ensures packages nested in directories are properly resolved
        };

        //cache it
        await fileCache.setItem(args.path, result);

        return result;
      });
    },
  };
};
