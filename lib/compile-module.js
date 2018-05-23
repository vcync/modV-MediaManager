const path = require('path');
const recursiveDeps = require('recursive-deps');
const webpack = require('webpack');
const yarn = require('yarn-api');

const babelPresetEnv = require('babel-preset-env');

const log = require('./log');

const internalDeps = [
  // 'meyda',
  'modv',
  'module2d',
  'module3d',
  'moduleshader',
  'moduleisf',
];

module.exports = function compileModule(MediaManager) {
  MediaManager.prototype.compileModule = function compileModule(filePath) {
    // 1. install file deps
    recursiveDeps(filePath).then((dependencies) => {
      const deps = [...new Set(dependencies)]
        .filter(dep => internalDeps.indexOf(dep.toLowerCase()) < 0);

      if (!deps.length) return;

      log('🛒  Installing', ...deps, 'for', filePath);

      const yarnArgs = deps
        .concat(['--modules-folder', path.join(path.dirname(filePath), 'node_modules')]);

      yarn.add(yarnArgs, (err) => {
        if (err) throw err;

        log('🛍  Installed!');

        // 2. webpack compilation
        // ---
        // @todo figure out a way to allow modv and local
        // classes/libs (three.js/Module/Module2D/ModuleISF etc)
        // to be skipped here so extra data doesn't need transferring

        const webpackConfig = {
          entry: filePath,
          output: {
            path: path.join(path.dirname(filePath), 'compiled'),
            filename: path.basename(filePath),
            libraryTarget: 'umd',
          },
          module: {
            rules: [
              {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                  loader: 'babel-loader',
                  options: {
                    presets: [babelPresetEnv],
                  },
                },
              },
            ],
          },
        };

        console.log(webpackConfig);

        webpack(webpackConfig, (err, stats) => {
          if (err || stats.hasErrors()) {
            const statsJson = stats.toJson('minimal');
            statsJson.errors.forEach(error => console.error(error));
            throw err;
          }

          // 3. save compiled module to user media directory

          // 4. update modv clients with new file contents (then eval in modv)
        });
      });
    });
  };
};
