import * as esbuild from "esbuild-wasm";
import axios from "axios";
import localforage from "localforage";

const fileCache = localforage.createInstance({
  name: "filecache",
});

const packageCDN = "https://unpkg.com";

export const unpkgPathPlugin = (inputCode: string) => {
  return {
    name: "unpkg-path-plugin",
    setup(build: esbuild.PluginBuild) {
      //base "index.js" (user input textarea)
      build.onResolve({ filter: /(^index\.js$)/ }, () => {
        return { path: "index.js", namespace: "a" };
      });

      //relative imports inside imports (imports inside the packages imported in textarea)
      build.onResolve({ filter: /^\.+\// }, async (args: any) => {
        //importing relative paths inside other imports (./ and ../)
        return {
          namespace: "a",
          path: new URL(args.path, packageCDN + args.resolveDir + "/").href,
        };
      });

      //root packages (imports inside the textarea)
      build.onResolve({ filter: /.*/ }, async (args: any) => {
        return {
          namespace: "a",
          path: `${packageCDN}/${args.path}`,
        };
      });

      //onload
      build.onLoad({ filter: /.*/ }, async (args: any) => {
        console.log("onLoad", args);

        //just a fake index.js to use for now
        //will be replaced with whatever is typed in the browser
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
