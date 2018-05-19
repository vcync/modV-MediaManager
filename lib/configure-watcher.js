const path = require('path');
const log = require('./log');

module.exports = function configureWatcher(MediaManager) {
  MediaManager.prototype.configureWatcher = function configureWatcher() {
    const watcher = this.watcher;
    watcher
      .on('add', (changedPath) => {
        this.parseFile(changedPath);
      })
      .on('change', (changedPath) => {
        this.parseFile(changedPath);
        log(`🔄  File ${changedPath} has been changed`);
      })
      .on('unlink', (filePath) => {
        log(`➖  File ${filePath} has been removed`);

        const parsed = path.parse(filePath);

        const seperated = filePath.split(path.sep);
        const profile = seperated[seperated.length - 3];
        const directory = seperated[seperated.length - 2];
        const base = parsed.base;
        const filename = parsed.name;

        const categories = {
          palette: true,
          preset: true,
          video: true,
          image: true,
        };

        if (!(directory in categories)) return;

        console.log(seperated, directory);

        const delObj = {
          type: directory,
          profile,
        };

        if (
          directory === 'palette' ||
          directory === 'preset' ||
          directory === 'video'
        ) {
          delObj.name = filename;
        } else {
          delObj.name = base;
        }

        this.sendFileDeleteUpdate(delObj);
      })
      .on('addDir', (changedPath) => {
        log(`➕  Directory ${changedPath} has been added`);
        const seperated = changedPath.split(path.sep);

        if (seperated[seperated.length - 2] === this.mediaFolderName) {
          this.addProfile(seperated[seperated.length - 1]);
        }
      })
      .on('unlinkDir', (changedPath) => {
        log(`➖  Directory ${changedPath} has been removed`);

        const seperated = changedPath.split(path.sep);

        if (seperated[seperated.length - 2] === this.mediaFolderName) {
          this.removeProfile(seperated[seperated.length - 1]);
        }
      })
      .on('ready', () => {
        if (!this.firstRun) return;
        log('👍  Finished searching through media');
        this.firstRun = false;
        this.updateClients();
      });
  };
};
