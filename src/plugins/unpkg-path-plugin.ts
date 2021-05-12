import * as esbuild from "esbuild-wasm";
import axios from "axios";
import localforage from "localforage";

const fileCache = localforage.createInstance({
  name: "filecache",
});

const packageCDN = "https://unpkg.com";

export const unpkgPathPlugin = () => {
  return {
    name: "unpkg-path-plugin",
    setup(build: esbuild.PluginBuild) {
      build.onResolve({ filter: /.*/ }, async (args: any) => {
        console.log("onResolve", args);
        if (args.path === "index.js") {
          return { path: args.path, namespace: "a" };
        }

        //for recursive importing via unpkg.
        if (args.path.includes("./") || args.path.includes("../")) {
          return {
            namespace: "a",
            path: new URL(args.path, packageCDN + args.resolveDir + "/").href,
          };
          //args.importer is the file making the call which allows proper url construction for nested imports
        }

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
            contents: `
              import React from 'react';
              console.log(message);
            `,
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
