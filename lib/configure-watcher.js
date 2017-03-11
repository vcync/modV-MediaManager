const path = require('path');
const log = require('./log');

module.exports = function(MediaManager) {
	MediaManager.prototype.configureWatcher = function configureWatcher() {
		let watcher = this.watcher;
		watcher
			.on('add', changedPath => {
				this.parseFile(changedPath);
			})
			.on('change', changedPath => log(`🔄  File ${changedPath} has been changed`))
			.on('unlink', filePath => {
				log(`➖  File ${filePath} has been removed`);

				let parsed = path.parse(filePath);

				let seperated	= filePath.split(path.sep);
				let profile		= seperated[seperated.length-3];
				let directory	= seperated[seperated.length-2];
				let base		= parsed.base;
				let filename	= parsed.name;

				if(
					directory !== 'palette' ||
					directory !== 'preset' ||
					directory !== 'video' ||
					directory !== 'image'
				) return;

				let delObj = {
					type: directory,
					profile: profile
				};

				if(
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
			.on('addDir', changedPath => {
				log(`➕  Directory ${changedPath} has been added`);
			})
			.on('unlinkDir', changedPath => {
				log(`➖  Directory ${changedPath} has been removed`);

				let seperated = changedPath.split(path.sep);

				if(seperated[seperated.length-2] === this.mediaFolderName) {
					this.removeProfile(seperated[seperated.length-1]);
				}
			}).
			on('ready', () => {
				log('👍  Finished searching through media');
				this._firstRun = false;
				this.updateClients();
			});
	};
};