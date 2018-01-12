const Ffmpeg = require('fluent-ffmpeg');
const ffbinaries = require('ffbinaries');
const fs = require('fs');
const log = require('./log');
const path = require('path');
const yesno = require('yesno');

module.exports = function detectFfmpeg(MediaManager) {
  MediaManager.prototype.detectFfmpeg = function detectFfmpeg(callback, autoDownload) {
    const ffmpegCommand = new Ffmpeg();

    function download(dest, platform, destFfmpeg) {
      ffbinaries.downloadFiles({ components: ['ffmpeg'], destination: dest }, () => {
        log(`Downloaded ffmpeg for ${platform}`);
        callback(destFfmpeg);
      });
    }

    ffmpegCommand._getFfmpegPath((err, result) => { //eslint-disable-line
      if (err || result.trim() === '') {
        const dest = path.join(this.dataPath, 'binaries');
        let destFfmpeg = path.join(dest, 'ffmpeg');
        const platform = ffbinaries.detectPlatform();
        const isWin = /^win/.test(process.platform);

        if (isWin) destFfmpeg += '.exe';

        fs.open(destFfmpeg, 'r', (err) => {
          if (err && err.code === 'ENOENT') {
            log('‼️  ffmpeg not found locally, in environment or within path');

            if (autoDownload) {
              log('ℹ️  Auto downloading local copy of ffmpeg');
              download(dest, platform, destFfmpeg);
              return;
            }

            yesno.ask(`Do you want to download ffmpeg locally for platform ${platform}? (yes)`, true, (ok) => {
              if (ok) {
                download(dest, platform, destFfmpeg);
              } else {
                console.log('\n');
                log('ffmpeg is required for the modV Media Manager. Exiting...');
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
