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
			.on('unlink', changedPath => log(`➖  File ${changedPath} has been removed`))
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
				this.updateClients();
			});
	};
};