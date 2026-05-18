const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch and resolve packages from the workspace root
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Handle TypeScript ESM: the shared package uses .js extensions in imports.
// Metro needs to resolve foo.js → foo.ts when the .js file doesn't exist.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js')) {
    try {
      return (originalResolveRequest ?? context.resolveRequest)(
        context,
        moduleName.slice(0, -3) + '.ts',
        platform,
      );
    } catch {
      // fall through to default resolution
    }
  }
  return (originalResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
