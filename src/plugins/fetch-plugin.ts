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

        const result: esbuild.OnLoadResult = {
          loader: "jsx",
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
