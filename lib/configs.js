const fs = require("fs");
const path = require("path");
const homeDir = require('os').homedir();
const scriptDir = path.dirname(require.main.filename);
const errors = require("./errors.js");
const yaml = require("yaml");
const jingJar = "jing-20131210.jar";
const cwd = process.cwd();
const sourceRepoPaths = [ "local", "std", "src", "locale", "modules", "cslschema", "cslmschema" ];
const defaultConfig =
      "groupID: 2319948\n"
      "path:\n"
      + "    styletests: false\n"
      + "    local: false\n"
      + "    std: false\n"
      + "    src: false\n"
      + "    locale: false\n"
      + "    modules: false\n"
      + "    cslschema: false\n"
      + "    cslmschema: false";
const configInstructions =
      "Configuration\n\n"
      + "To use the cslrun command for building and\n"
      + "running style tests, edit the styletests line\n"
      + "in " + path.join(homeDir, ".cslrun.yaml") + ":\n\n"
      + "    styletests: path/to/styles/directory\n\n"
      + "The path should be to the parent directory of\n"
      + "subdirectories named for the styles to be tested.\n"
/*
 * Config priority:
 * - User homeDir config
 * - Current directory config
 *
 * Should allow paths to be set as relative to homeDir or absolute,
 * but internally use always absolute for the config paths
 *
 */
function makeAbsolute(basePath, config) {
    if (config && "object" === typeof config.path && "undefined" === typeof config.path.length) {
        for (var key in config.path) {
            if (config.path[key]) {
                if (!path.isAbsolute(config.path[key])) {
                    config.path[key] = path.join(basePath, config.path[key]);
                }
            }
        }
    } else {
        var error = new Error("Corrupt file (fix, remove, or revert): " + path.join(basePath, "cslrun.yaml"));
        throw error;
    }
}
function getConfig(dirName, hiddenFile) {
    var prefix = "";
    if (hiddenFile) {
        prefix = ".";
    }
    try {
        var yamlSrc = fs.readFileSync(path.join(dirName, prefix + "cslrun.yaml")).toString();
        var config = yaml.parse(yamlSrc);
    } catch (err) {
        var error = new Error("Unable to parse config file: " + path.join(dirName, prefix + "cslrun.yaml"));
        throw error;
    }
    makeAbsolute(dirName, config);
    return config;
}
try {
    if (process.env.TRAVIS) {
        var config = {
            path: {}
        };
    } else {
        if (!fs.existsSync(path.join(homeDir, ".cslrun.yaml"))) {
            fs.writeFileSync(path.join(homeDir, ".cslrun.yaml"), defaultConfig);
        }
        // Flag looks for a hidden file, .cslrun.yaml
        var config = getConfig(homeDir, true);
        config.path.configdir = homeDir;
    }
    var pth = cwd;
    while (path.basename(pth)) {
        if (fs.existsSync(path.join(pth, "cslrun.yaml"))) {
            if (pth === homeDir) {
                throw new Error("Found cslrun.yaml configuration file (without a dot) in home directory " + homeDir + "\n\nIn the home directory ONLY, use .cslrun.yaml instead (with a dot---and it should already exist).\n");
                break;
            }
            var extraConfig = getConfig(pth);
            makeAbsolute(pth, extraConfig);
            for (var key in extraConfig.path) {
                config.path[key] = extraConfig.path[key];
            }
            config.path.configdir = pth;
            break;
        }
        pth = path.dirname(pth);
    }
} catch (err) {
    errors.errorHandler(err);
}
if (!config.path.styletests) {
    errors.setupGuidance("Some setup required.");
}

/*
 * Schemata locations
 */
if (!config.path.cslschema || !fs.existsSync(config.path.cslschema)
    || !config.path.cslmschema || !fs.existsSync(config.path.cslmschema)) {
    config.path.cslschema = require("citeproc-csl-schemata").csl;
    config.path.cslmschema = require("citeproc-csl-schemata").cslm;
}
/*
 * Locale locations
 */
if (!config.path.locale || !fs.existsSync(config.path.locale)
    || !fs.readdirSync(config.path.locale).length) {

    config.path.locale = require("citeproc-locales");
}

if (!config.path.modules || !fs.existsSync(config.path.modules)
    || !fs.readdirSync(config.path.modules).length) {

    config.path.modules = require("citeproc-juris-modules");
}

if (sourceRepoPaths.filter(k => config.path[k]).length < sourceRepoPaths.length) {
    config.mode = "styleMode";
} else {
    config.mode = "fullMode"
}
config.path.cwd = cwd;
config.path.scriptdir = scriptDir;
config.path.jing = path.join(scriptDir, "jing", jingJar);
if (process.env.TRAVIS) {
    config.path.fixturedir = path.join(homeDir, ".cslTestFixtures");
} else {
    config.path.fixturedir = path.join(config.path.configdir, ".cslTestFixtures");
}
config.path.chai = path.join(scriptDir, "node_modules", "chai", "index.js");
module.exports = config;
