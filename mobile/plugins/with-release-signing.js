// Signs Android release builds with a private upload key when these Gradle
// properties exist (keep them in ~/.gradle/gradle.properties, never in the repo):
//   POCKET_CLAUDE_UPLOAD_STORE_FILE, POCKET_CLAUDE_UPLOAD_STORE_PASSWORD,
//   POCKET_CLAUDE_UPLOAD_KEY_ALIAS, POCKET_CLAUDE_UPLOAD_KEY_PASSWORD
// Without them, release builds fall back to the debug key so anyone can build from source.
const { withAppBuildGradle } = require('@expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (findProperty('POCKET_CLAUDE_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('POCKET_CLAUDE_UPLOAD_STORE_FILE'))
                storePassword findProperty('POCKET_CLAUDE_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('POCKET_CLAUDE_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('POCKET_CLAUDE_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('POCKET_CLAUDE_UPLOAD_STORE_FILE')) return cfg;
    src = src.replace(/signingConfigs \{\n/, (m) => m + RELEASE_CONFIG.slice(1) + '\n');
    src = src.replace(
      /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/,
      "$1signingConfig findProperty('POCKET_CLAUDE_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    if (!src.includes('signingConfigs.release :')) throw new Error('with-release-signing: build.gradle layout changed');
    cfg.modResults.contents = src;
    return cfg;
  });
};
