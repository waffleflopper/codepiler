import * as esbuild from "esbuild-wasm";

const packageCDN = "https://unpkg.com";

export const unpkgPathPlugin = () => {
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
    },
  };
};
