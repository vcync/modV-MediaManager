const yarn = require('yarn-api');
const recursiveDeps = require('recursive-deps');
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

      yarn.add(deps, (err) => {
        if (err) throw err;

        log('🛍  Installed!');

        // 2. webpack compilation
        // ---
        // @todo figure out a way to allow modv and local
        // classes/libs (three.js/Module/Module2D/ModuleISF etc)
        // to be skipped here so extra data doesn't need transferring

        // 3. save compiled module to user media directory

        // 4. update modv clients with new file contents (then eval in modv)
      });
    });
  };
};
