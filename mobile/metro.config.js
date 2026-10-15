// Resolve packages only from this app's node_modules; the parent folder holds the
// web app's own copies (e.g. a different React) that must never be bundled here.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;
module.exports = config;
