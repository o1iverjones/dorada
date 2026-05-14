const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch workspace packages (monorepo support)
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Shim Node built-ins not available in React Native
const assertShim = path.resolve(projectRoot, "src/shims/assert.js");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "assert") {
    return { filePath: assertShim, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
