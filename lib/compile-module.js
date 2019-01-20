const path = require('path');
const fs = require('fs');
const recursiveDeps = require('recursive-deps');
const webpack = require('webpack');
const npm = require('npm');

const babelPresetEnv = require('babel-preset-env');

const log = require('./log');

const npmConfig = {
  color: true,
  loglevel: 'error',
  maxsockets: 1,
  parseable: true,
  progress: false,
  save: true,
  unicode: true,
};

const internalDeps = [
  // 'meyda',
  // 'modv',
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

function doWebpack(filePath, finalDirectory, outputName) {
  return new Promise((resolve, reject) => {
    // 2. webpack compilation
    // ---
    // @todo figure out a way to allow modv and local
    // classes/libs (three.js/Module/Module2D/ModuleISF etc)
    // to be skipped here so extra data doesn't need transferring

    const filename = outputName || path.basename(filePath);
    const outputPath = finalDirectory || path.join(path.dirname(filePath), 'compiled');

    const webpackConfig = {
      entry: filePath,
      output: {
        path: outputPath,
        filename,
        libraryTarget: 'var',
      },
      resolve: {
        extensions: ['.js', '.vue', '.json'],
      },
      resolveLoader: {
        modules: [path.resolve(__dirname, '../node_modules'), 'node_modules'],
      },
      recordsPath: path.join(this.mediaDirectoryPath, 'records.json'),
      module: {
        rules: [
          {
            test: /\.(glsl|vert|frag|fs|vs)$/,
            loader: 'text-loader'
          },
          // {
          //   test: /\.js$/,
          //   exclude: /(node_modules|bower_components)/,
          //   use: {
          //     loader: 'babel-loader',
          //     options: {
          //       presets: [babelPresetEnv],
          //     },
          //   },
          // },
          // {
          //   test: /\.vue$/,
          //   loader: 'vue-loader',
          //   options: vueLoaderConfig
          // },
        ],
      },
    };

    webpack(webpackConfig, (err, stats) => {
      if (err || stats.hasErrors()) {
        reject(err);
        if (stats) {
          const statsJson = stats.toJson('minimal');
          statsJson.errors.forEach(error => console.error(error));
        }
      }

      // 3. save compiled module to user media directory

      // 4. update modv clients with new file contents (then eval in modv)

        resolve(path.join(outputPath, filename));
    });
  });
}

module.exports = function compileModule(MediaManager) {
  MediaManager.prototype.doWebpack = function doWebpackWrap(filePath, finalDirectory, outputName) {
    return doWebpack.bind(this)(filePath, finalDirectory, outputName);
  };

  MediaManager.prototype.installDeps = function installDeps({ deps, dirPath }) {
    return new Promise((resolve, reject) => {
      npm.load(Object.assign(npmConfig, { prefix: dirPath }), (err) => {
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
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    });
  };

  MediaManager.prototype.installDepsFromJson = function installDeps({ dirPath }) {
    return new Promise((resolve, reject) => {
      npm.load(Object.assign(npmConfig, { prefix: dirPath }), (err) => {
        if (err) {
          reject(err);
        }

        const pathSplit = dirPath.split(path.sep);
        const thingName = pathSplit[pathSplit.length - 1];

        log('🛒  Installing packages for', thingName);

        npm.commands.install((err) => {
          if (err) {
            reject(err);
          }

          log(`🛍   Installed packages for ${thingName}`);
          resolve();
        });
      });
    });
  };

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

        if (!deps.length) {
          this.doWebpack(filePath).then(resolve);
          return;
        }

        ensurePackageJson({ dirPath });

        this.installDeps({ dirPath, deps }).then(() => {
          this.doWebpack(filePath).then(resolve);
        }).catch(reject);
      });
    });
  };
};
