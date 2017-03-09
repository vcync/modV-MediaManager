const ffmpeg		= require('fluent-ffmpeg');
const ffbinaries	= require('ffbinaries');
const fs			= require('fs');
const log			= require('./log');
const path			= require('path');
const yesno			= require('yesno');

module.exports = function(MediaManager) {
	MediaManager.prototype.detectFfmpeg = function detectFfmpeg(callback) {
		let ffmpegCommand = new ffmpeg(); //jshint ignore:line
		ffmpegCommand._getFfmpegPath((err, result) => {

			if(err || result.trim() === '') {

				let dest = path.join(__dirname, '/binaries');
				let destFfmpeg = path.join(dest,'/ffmpeg');
				let platform = ffbinaries.detectPlatform();

				fs.open(destFfmpeg, 'r', (err) => {
					if(err && err.code === 'ENOENT') {
						log('‼️  ffmpeg not found locally, in environment or within path');

						yesno.ask(`Do you want to download ffmpeg locally for platform ${platform}? (yes)`, true, function(ok) {
							if(ok) {
								ffbinaries.downloadFiles({components: ['ffmpeg'], destination: dest}, function() {
									log('Downloaded ffmpeg for ' + platform);
									callback(destFfmpeg);
								});
							} else {
								process.exit();
							}
						});
					} else {
						log('ffmpeg found locally for platform', platform);
						callback(destFfmpeg);
					}
				});
			} else {
				log('ffmpeg found in path or environment');
				callback(result);
			}
		});
	};
};