const animated = require('animated-gif-detector');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const mv = require('mv');
const path = require('path');
const log = require('./log');
const logError = require('./logError');


module.exports = function parseFile(MediaManager) {
  MediaManager.prototype.parseFile = function parseFile(filePath) {
    const parsed = path.parse(filePath);

    const seperated = filePath.split(path.sep);
    const profile = seperated[seperated.length - 3];
    const directory = seperated[seperated.length - 2];
    const fileExt = parsed.ext.replace('.', '').toLowerCase();
    const base = parsed.base;
    const filename = parsed.name;

    let contents;
    let fileParsed;

    const profileObject = this.getOrMakeProfile(profile);

    if (directory === 'module') {
      log('📄  Found module in', `${profile}:`, filename);

      this.compileModule(filePath).then((filePath) => {
        // contents = fs.readFileSync(filePath, 'utf8');
        // if (!contents) return;

        const serverUrl = `http://localhost:3133${filePath.replace(this.mediaDirectoryPath, '')}`;

        profileObject.modules[filename] = serverUrl;

        this.sendFileAddUpdate({
          type: 'module',
          name: filename,
          path: serverUrl,
          profile,
        });

        console.log(JSON.stringify(profileObject, null, 2));
      });
    }

    if (directory === 'palette') {
      contents = fs.readFileSync(filePath, 'utf8');
      if (!contents) return;
      fileParsed = JSON.parse(contents);
      profileObject.palettes[filename] = fileParsed;
      log('🎨  Found palette in', `${profile}:`, filename);
      this.sendFileAddUpdate({
        type: 'palette',
        name: filename,
        contents: fileParsed,
        profile,
      });
    }

    if (directory === 'preset') {
      contents = fs.readFileSync(filePath, 'utf8');
      if (!contents) return;
      fileParsed = JSON.parse(contents);
      profileObject.presets[filename] = fileParsed;
      log('💾  Found preset in', `${profile}:`, filename);
      this.sendFileAddUpdate({
        type: 'preset',
        name: filename,
        contents: fileParsed,
        profile,
      });
    }

    if (directory === 'video') {
      if (fileExt in this.viable.video) {
        profileObject.videos[filename] = `http://localhost:3133${filePath.replace(this.mediaDirectoryPath, '')}`;

        log('📼  Found video in', `${profile}:`, filename);
        this.sendFileAddUpdate({
          type: 'video',
          name: filename,
          path: `http://localhost:3133${filePath.replace(this.mediaDirectoryPath, '')}`,
          profile,
        });
      }
    }

    if (directory === 'image') {
      if (fileExt in this.viable.image) {
        log('📷  Found image in', `${profile}:`, base);

        if (fileExt.toLowerCase() === 'gif' && animated(fs.readFileSync(filePath))) {
          log('Animated GIF detected:', filePath);
          let outputFile = path.join(this.mediaDirectoryPath, '/', profile, '/video/', filename);
          outputFile += '.mp4';

          // Check if we need to convert
          fs.open(outputFile, 'r', (err) => {
            if (err && err.code === 'ENOENT') {
              log('Converting', filePath, 'to MP4');
              ffmpeg.setFfmpegPath(this.ffmpegPath);
              ffmpeg(filePath)
                .inputFormat('gif')
                .format('mp4')
                .noAudio()
                .videoCodec('libx264')
                .on('error', (err) => {
                  log(`An error occurred converting ${filePath}:`, err.message);
                })
                .on('end', () => {
                  log('Processing', filePath, 'finished!');
                  profileObject.videos[filename] = `http://localhost:3133${outputFile.replace(process.cwd(), '.').replace(this.mediaDirectoryPath, '')}`;

                  this.sendFileAddUpdate({
                    type: 'video',
                    name: filename,
                    path: `http://localhost:3133${outputFile.replace(process.cwd(), '.').replace(this.mediaDirectoryPath, '')}`,
                    profile,
                  });

                  mv(filePath, `./media/${profile}/processed-gifs/${base}`, { mkdirp: true }, (err) => {
                    if (err) logError(err);
                  });
                })
                .save(outputFile);
            } else {
              mv(filePath, `./media/${profile}/processed-gifs/${filename}.gif`, { mkdirp: true }, (err) => {
                if (err) logError(err);
              });
            }
          });
        } else {
          profileObject.images[base] = `http://localhost:3133${filePath.replace(this.mediaDirectoryPath, '')}`;
          this.sendFileAddUpdate({
            type: 'image',
            name: base,
            path: `http://localhost:3133${filePath.replace(this.mediaDirectoryPath, '')}`,
            profile,
          });
        }
      }
    }
  };
};
