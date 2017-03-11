const animated	= require('animated-gif-detector');
const ffmpeg	= require('fluent-ffmpeg');
const fs		= require('fs');
const log		= require('./log');
const logError	= require('./logError');
const mv		= require('mv');
const path		= require('path');

module.exports = function(MediaManager) {
	MediaManager.prototype.parseFile = function parseFile(filePath) {
		let parsed = path.parse(filePath);

		let seperated	= filePath.split(path.sep);
		let profile		= seperated[seperated.length-3];
		let directory	= seperated[seperated.length-2];
		let fileExt		= parsed.ext.replace('.', '').toLowerCase();
		let base		= parsed.base;
		let filename	= parsed.name;

		let contents, fileParsed;

		let profileObject = this.getOrMakeProfile(profile);

		if(directory === 'palette') {
			contents = fs.readFileSync(filePath, 'utf8');
			if(!contents) return;
			fileParsed = JSON.parse(contents);
			profileObject.palettes[filename] = fileParsed;
			log('🎨  Found palette in', profile + ':', filename);
			this.sendFileAddUpdate({
				type: 'palette',
				name: filename,
				contents: fileParsed,
				profile: profile
			});
		}

		if(directory === 'preset') {
			contents = fs.readFileSync(filePath, 'utf8');
			if(!contents) return;
			fileParsed = JSON.parse(contents);
			profileObject.presets[filename] = fileParsed;
			log('💾  Found preset in', profile + ':', filename);
			this.sendFileAddUpdate({
				type: 'preset',
				name: filename,
				contents: fileParsed,
				profile: profile
			});
		}

		if(directory === 'video') {
			if(fileExt in this.viable.video) {
				profileObject.files.videos.push({'name': filename, 'path': filePath});
				log('📼  Found video in', profile + ':', filename);
				this.sendFileAddUpdate({
					type: 'video',
					name: filename,
					path: filePath,
					profile: profile
				});
			}
		}

		if(directory === 'image') {
			if(fileExt in this.viable.image) {
				log('📷  Found image in', profile + ':', base);

				if(fileExt.toLowerCase() === 'gif' && animated(fs.readFileSync(filePath))) {

					log('Animated GIF detected:', filePath);
					let outputFile = path.join(this.options.mediaDirectoryPath, '/', profile, '/video/', filename);
					outputFile += '.mp4';

					// Check if we need to convert
					fs.open(outputFile, 'r', (err) => {
						if(err && err.code === 'ENOENT') {
							log('Converting', filePath, 'to MP4');
							ffmpeg.setFfmpegPath(this._ffmpegPath);
							ffmpeg(filePath)
								.inputFormat('gif')
								.format('mp4')
								.noAudio()
								.videoCodec('libx264')
								.on('error', function(err) {
									log('An error occurred converting ' + filePath + ':', err.message);
								})
								.on('end', function() {
									log('Processing', filePath, 'finished!');
									profileObject.files.videos.push({
										'name': filename,
										'path': outputFile.replace(process.cwd(), '.')
									});

									this.sendFileAddUpdate({
										type: 'video',
										name: filename,
										path: outputFile.replace(process.cwd(), '.'),
										profile: profile
									});

									mv(filePath, './media/' + profile + '/processed-gifs/' + base, {mkdirp: true}, function(err) {
										if(err) logError(err);
									});
								})
								.save(outputFile);
						} else {
							mv(filePath, './media/' + profile + '/processed-gifs/' + filename + '.gif', {mkdirp: true}, function(err) {
								if(err) logError(err);
							});
						}
					});

				} else {
					profileObject.files.images.push({'name': base, 'path': filePath});
					this.sendFileAddUpdate({
						type: 'image',
						name: base,
						path: filePath,
						profile: profile
					});
				}
			}
		}
	};
};