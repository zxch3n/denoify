"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFactory = void 0;
const st = require("scripting-tools");
const path = require("path");
const typeSafety_1 = require("evt/tools/typeSafety");
const Scheme_1 = require("./Scheme");
const getTsconfigOutDirIfDenoified_1 = require("./getTsconfigOutDirIfDenoified");
const commentJson = require("comment-json");
const getProjectRoot_1 = require("../tools/getProjectRoot");
const fs = require("fs");
const knownPorts = (() => {
    const { third_party, builtins } = commentJson.parse(fs.readFileSync(path.join(getProjectRoot_1.getProjectRoot(), "known-ports.jsonc")).toString("utf8"));
    return {
        ...third_party,
        ...builtins
    };
})();
/**
 *
 * Example 1:
 *
 * Context:
 * - package.json "dependencies" has an entry { "js-yaml": "~3.12.0" }
 * - There is no entry "js-yaml" in package.json "denoPorts"
 * - The version field in "./node_modules/js-yaml/package.json" is "3.12.1"
 *
 * Resolve is called with:
 * nodeModuleName: "js-yaml"
 *
 * ->
 *
 * The resolution goes as follow:
 * - The entry "js-yaml" in package.json is not a "github:xxx" scheme. Skip
 * - We use "./node_modules/js-yaml/package.json" repository field to lookup
 *   the github repo hosting the module: KSXGitHub/simple-js-yaml-port-for-deno.
 *   We found out that it is not a denoified module ( there is not a "./mod.ts" file
 *   containing the work "denoify"). Skip
 * - There is no entry "js-yaml" in package.json "denoPorts". Skip
 * - There is an entry { "js-yaml": "https://deno.land/x/js_yaml_port/js-yaml.js" }
 *   in knownPort.json, GET https://deno.land/x/js_yaml_port@3.12.1/js-yaml.js is not a 404. Done
 *
 * {
 * "type": "HANDMADE PORT",
 * "scheme": {
 *     "type": "url",
 *     "urlType": "deno.land",
 *     "baseUrlWithoutBranch": "https://deno.land/x/js_yaml_port",
 *     "branch": "3.12.1",
 *     "pathToIndex": "js-yaml.js"
 * }
 * }
 *
 *
 * If the version field in "./node_modules/js-yaml/package.json" was "3.12.2"
 * as GET https://deno.land/x/js_yaml_port@3.12.2/js-yaml.js gives a 404
 * ( KSXGitHub/simple-js-yaml-port-for-deno as no "v3.12.2" or "3.12.2" branch )
 * the result would have been the same without the "branch" property in the "scheme" and
 * a warning would have been printed to the console.
 *
 * Example 2:
 *
 * Context:
 * - package.json "dependencies" has no entry for "fs"
 * - There is no entry "fs" in package.json "denoPorts"
 *
 * Resolve is called with:
 * nodeModuleName: "fs"
 *
 * ->
 *
 * The resolution goes as follow:
 * - "fs" is not present in "dependencies" nor "devDependencies" of package.json, assuming node builtin.
 * - There is no entry for "fs" in package.json "denoPorts". Skip
 * - There is an entry { "fs": "https://deno.land/std/node/fs.ts" } in known port. Done
 *
 * {
 * "type": "HANDMADE PORT",
 * "scheme": {
 *     "type": "url",
 *     "urlType": "deno.land",
 *     "baseUrlWithoutBranch": "https://deno.land/std",
 *     "pathToIndex": "node/fs.ts"
 * }
 * }
 *
 * Example 3:
 *
 * Context:
 * - package.json "dependencies" has an entry { "ts-md5": "~1.2.7" }
 * - There is no entry "ts-md5" in package.json "denoPorts"
 * - The version field in "./node_modules/js-yaml/package.json" is "1.2.7"
 *
 * Resolve is called with:
 * nodeModuleName: "ts-md5"
 *
 * ->
 *
 * The resolution goes as follow:
 * - The entry "ts-md5" in package.json is not a "github:xxx" scheme. Skip
 * - We use "./node_modules/ts-md5/package.json" repository field to lookup
 *   the github repo hosting the module: cotag/ts-md5.
 *   We found out that it is not a denoified module. Skip
 * - There is no entry "ts-md5" in package.json "denoPorts". Skip
 * - There is an entry { "ts-md5": "garronej/ts-md5" }
 *   in knownPort.json, GET https://raw.githubusercontent.com/garronej/ts-md5/v1.2.7/mod.ts is not a 404
 *   and contain the word denoify. Done
 *
 * We lookup the "outDir" in https://raw.githubusercontent.com/garronej/ts-md5/v1.2.7/tsconfig.json,
 * we need it so import "ts-md5/dist/md5_worker" can be replaced by "ts-md5/deno_dist/md5_worker.ts" later on.
 *
 * {
 * "type": "DENOIFIED MODULE",
 * "scheme": {
 *     "type": "github",
 *     "userOrOrg": "garronej",
 *     "repositoryName": "ts-md5",
 *     "branch": "v1.2.7"
 * },
 * "tsconfigOutDir": "dist"
 * }
 *
 * Example 4:
 *
 * Context:
 * - package.json "dependencies" has an entry { "ts-md5": "garronej/ts-md5#1.2.7" }
 *
 * Resolve is called with:
 * nodeModuleName: "ts-md5"
 *
 * ->
 *
 * The resolution goes as follow:
 * - The entry "js-yaml" in package.json ("garronej/ts-md5") is a "github:xxx" scheme.
 *   GET https://raw.githubusercontent.com/garronej/ts-md5/v1.2.7/mod.ts is not a 404 and the file
 *   contains the word "denoify". Done
 *
 * We lookup the "outDir" in https://raw.githubusercontent.com/garronej/ts-md5/v1.2.7/tsconfig.json,
 *
 * {
 * "type": "DENOIFIED MODULE",
 * "scheme": {
 *     "type": "github",
 *     "userOrOrg": "garronej",
 *     "repositoryName": "ts-md5",
 *     "branch": "v1.2.7"
 * },
 * "tsconfigOutDir": "dist"
 * }
 *
 * Example 5:
 *
 * Context:
 * - package.json "dependencies" has an entry { "run-exclusive": "^2.1.0" }
 * - The version field in "./node_modules/run-exclusive/package.json" is "2.1.12".
 *
 * Resolve is called with:
 * nodeModuleName: "run-exclusive"
 *
 * ->
 *
 * The resolution goes as follow:
 * - The entry "run-exclusive" in package.json is not a "github:xxx" scheme. Skip
 * - We use "./node_modules/ts-md5/package.json" repository field to lookup
 *   the github repo hosting the module: garronej/run-exclusive.
 *   https://raw.githubusercontent.com/garronej/ts-md5/2.1.12/mod.ts is not a 404
 *   and contain the word "denoify". Done
 *
 * We lookup the "outDir" in https://raw.githubusercontent.com/garronej/run-exclusive/v2.1.12/tsconfig.json,
 *
 * {
 * "type": "DENOIFIED MODULE",
 * "scheme": {
 *     "type": "github",
 *     "userOrOrg": "garronej",
 *     "repositoryName": "run-exclusive",
 *     "branch": "2.1.12"
 * },
 * "tsconfigOutDir": "dist"
 * }
 *
 */
function resolveFactory(params) {
    const { log } = params;
    const { denoPorts } = (() => {
        const denoPorts = {};
        [knownPorts, params.userProvidedPorts].forEach(record => Object.keys(record).forEach(nodeModuleName => denoPorts[nodeModuleName] = record[nodeModuleName]));
        return { denoPorts };
    })();
    const allDependencies = {
        ...params.dependencies,
        ...params.devDependencies
    };
    const devDependenciesNames = Object.keys(params.devDependencies);
    const getTargetModulePath = (nodeModuleName) => st.find_module_path(nodeModuleName, params.projectPath);
    const isInUserProvidedPort = (nodeModuleName) => nodeModuleName in params.userProvidedPorts;
    async function resolve(params) {
        const { nodeModuleName //js-yaml
         } = params;
        if (!(nodeModuleName in allDependencies)) {
            if (!(nodeModuleName in denoPorts)) {
                return {
                    "type": "NON-FATAL UNMET DEPENDENCY",
                    "kind": "BUILTIN"
                };
            }
            const scheme = Scheme_1.Scheme.parse(denoPorts[nodeModuleName]);
            const { tsconfigOutDir } = await getTsconfigOutDirIfDenoified_1.getTsconfigOutDirIfDenoified({ scheme });
            return !!tsconfigOutDir ? {
                "type": "DENOIFIED MODULE",
                scheme,
                tsconfigOutDir
            } : {
                "type": "HANDMADE PORT",
                scheme
            };
        }
        let repo = undefined;
        walk: {
            let scheme;
            //TODO: Refactor
            if (Scheme_1.Scheme.GitHub.matchStr(allDependencies[nodeModuleName])) {
                //  allDependencies[nodeModuleName] === "github:garronej/ts-md5#1.2.7"
                scheme = await Scheme_1.Scheme.GitHub.parse(allDependencies[nodeModuleName]);
            }
            else {
                //  allDependencies[nodeModuleName] === "^1.2.3"
                break walk;
            }
            typeSafety_1.assert(scheme.type === "github");
            repo = scheme;
        }
        const { version, // 3.13.1 (version installed)
        repository: repositoryEntryOfPackageJson } = JSON.parse(fs.readFileSync(path.join(getTargetModulePath(nodeModuleName), // node_modules/js-yaml
        "package.json")).toString("utf8"));
        repo = !!repo ? repo : (() => {
            const repositoryUrl = repositoryEntryOfPackageJson === null || repositoryEntryOfPackageJson === void 0 ? void 0 : repositoryEntryOfPackageJson["url"];
            if (!repositoryUrl) {
                return undefined;
            }
            const [repositoryName, userOrOrg] = repositoryUrl
                .replace(/\.git$/i, "")
                .split("/")
                .filter((s) => !!s)
                .reverse();
            if (!repositoryName || !userOrOrg) {
                return undefined;
            }
            return { repositoryName, userOrOrg };
        })();
        walk: {
            if (repo === undefined) {
                break walk;
            }
            const { repositoryName, userOrOrg } = repo;
            const resolveResult = await Scheme_1.Scheme.resolveVersion(Scheme_1.Scheme.parse(`github:${userOrOrg}/${repositoryName}`), { version });
            if (!resolveResult.couldConnect) {
                break walk;
            }
            const { scheme, notTheExactVersionWarning } = resolveResult;
            const { tsconfigOutDir } = await getTsconfigOutDirIfDenoified_1.getTsconfigOutDirIfDenoified({ scheme });
            if (!tsconfigOutDir) {
                break walk;
            }
            if (notTheExactVersionWarning) {
                log(notTheExactVersionWarning);
            }
            if (isInUserProvidedPort(nodeModuleName)) {
                log(`NOTE: ${nodeModuleName} is a denoified module, there is no need for an entry for in package.json denoPorts`);
            }
            return typeSafety_1.id({
                "type": "DENOIFIED MODULE",
                scheme,
                tsconfigOutDir
            });
        }
        walk: {
            if (!(nodeModuleName in denoPorts)) {
                break walk;
            }
            const resolveResult = await Scheme_1.Scheme.resolveVersion(Scheme_1.Scheme.parse(denoPorts[nodeModuleName]), { version });
            if (!resolveResult.couldConnect) {
                log([
                    `WARNING: Even if the port ${denoPorts[nodeModuleName]}`,
                    `was specified for ${nodeModuleName} we couldn't connect to the repo`
                ]);
                break walk;
            }
            const { scheme, notTheExactVersionWarning } = resolveResult;
            if (!!notTheExactVersionWarning) {
                log(notTheExactVersionWarning);
            }
            return {
                "type": "HANDMADE PORT",
                scheme
            };
        }
        if (devDependenciesNames.includes(nodeModuleName)) {
            return {
                "type": "NON-FATAL UNMET DEPENDENCY",
                "kind": "DEV DEPENDENCY"
            };
        }
        throw new Error(`You need to provide a deno port for ${nodeModuleName}`);
    }
    return { resolve };
}
exports.resolveFactory = resolveFactory;
//# sourceMappingURL=resolve.js.map