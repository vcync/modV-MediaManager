const path = require('path');
const fs = require('fs');
const recursiveDeps = require('recursive-deps');
const webpack = require('webpack');
const npm = require('npm');

const babelPresetEnv = require('babel-preset-env');

const log = require('./log');

const internalDeps = [
  // 'meyda',
  // 'modv',
  'module2d',
  'module3d',
  'moduleshader',
  'moduleisf',
];

const ensurePackageJson = ({ dirPath }) => {
  const packageJsonPath = path.join(dirPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    // fs.writeFileSync(
    //   packageJsonPath,
    //   '{ "dependencies": { "modv": "2xAA/modV#2.0" } }',
    //   { encoding: 'utf8' },
    // );

    fs.writeFileSync(packageJsonPath, '{}', { encoding: 'utf8' });
  }
};

function doWebpack(filePath) {
  return new Promise((resolve, reject) => {
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
        libraryTarget: 'var',
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

    webpack(webpackConfig, (err, stats) => {
      if (err || stats.hasErrors()) {
        const statsJson = stats.toJson('minimal');
        statsJson.errors.forEach(error => console.error(error));
        reject(err);
      }

      // 3. save compiled module to user media directory

      // 4. update modv clients with new file contents (then eval in modv)
      resolve(path.join(path.dirname(filePath), 'compiled', path.basename(filePath)));
    });
  });
}

module.exports = function compileModule(MediaManager) {
  MediaManager.prototype.compileModule = function compileModule(filePath) {
    return new Promise((resolve, reject) => {
      const dirPath = path.dirname(filePath);

      // 1. install file deps
      //
      // Shameless clone of szymonkaliski's awesome Neutron
      // https://github.com/szymonkaliski/Neutron/blob/b8523e0efa3a7cc8bf5fcafc753d3d01b3c5338c/src/index.js#L54
      recursiveDeps(filePath).then((dependencies) => {
        const deps = [...new Set(dependencies)]
          .filter(dep => internalDeps.indexOf(dep.toLowerCase()) < 0);

        if (!deps.length) return;

        ensurePackageJson({ dirPath });

        npm.load({
          color: false,
          loglevel: 'silent',
          maxsockets: 1,
          parseable: true,
          prefix: dirPath,
          progress: true,
          save: true,
          unicode: false,
        },
        (err) => {
          if (err) {
            reject(err);
          }

          npm.commands.ls(deps, (_, data) => {
            const installedDeps = Object.keys(data.dependencies).filter(
              key => data.dependencies[key].missing === undefined,
            );

            const missingDeps = deps.filter(dep => installedDeps.indexOf(dep) < 0);

            if (missingDeps.length) {
              log('🛒  Installing', deps.join(', '), 'for', filePath);

              npm.commands.install(missingDeps, (err) => {
                if (err) {
                  reject(err);
                }

                log('🛍  Installed!');
                doWebpack(filePath).then(resolve);
              });
            } else {
              doWebpack(filePath).then(resolve);
            }
          });
        });
      });
    });
  };
};
