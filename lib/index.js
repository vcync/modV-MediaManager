const chokidar	= require('chokidar');
const fs		= require('fs');
const log		= require('./log');
const logError	= require('./logError');
const mkdirp	= require('mkdirp');
const path		= require('path');
const ospath	= require('ospath');
const ws		= require('nodejs-websocket');

class MediaManager {

	constructor(port, autoDownload) {

		this.port = port;

		/* Viable file formats */
		this.viable = {
			video: {
				'mp4': true,
				'm4v': true,
				'webm': true,
				'ogv': true
			},
			image: {
				'jpg': true,
				'jpeg': true,
				'png': true,
				'gif': true
			}
		};

		this.server = null;
		this.watcher = null;
		this.profiles = {};
		this._firstRun = true;

		this.makeDataDirectory();

		this.mediaDirectoryPath = path.join(this.dataPath, 'media');

		this.makeDefaultProfile();

		this.mediaFolderName = 'media';

		this.options = this.readOptions();
		this.setMediaDirectory(this.options.mediaDirectoryPath || this.mediaDirectoryPath);

		this.createServer();

		this.detectFfmpeg(ffmpegPath => {
			log(ffmpegPath);
			this._ffmpegPath = ffmpegPath;
			this.startServer(() => {
				log('👌  MediaManager started on port', this.port);
				this.setWatcher();
			});
		}, autoDownload);
	}

	get dataPath() {
		return path.join(ospath.data(), 'modV');
	}

	makeDataDirectory() {
		try {
			mkdirp.sync(this.dataPath);
		} catch(e) {
			throw 'Could not make data directory ' + e;
		}

		return true;
	}

	makeDefaultProfile() {
		try {
			mkdirp.sync(path.join(this.mediaDirectoryPath, 'default'));
		} catch(e) {
			throw 'Could not make default profile directory ' + e;
		}

		try {
			mkdirp.sync(path.join(this.mediaDirectoryPath, 'default', 'image'));
		} catch(e) {
			throw 'Could not make default profile directory ' + e;
		}

		try {
			mkdirp.sync(path.join(this.mediaDirectoryPath, 'default', 'video'));
		} catch(e) {
			throw 'Could not make default profile directory ' + e;
		}

		try {
			mkdirp.sync(path.join(this.mediaDirectoryPath, 'default', 'palette'));
		} catch(e) {
			throw 'Could not make default profile directory ' + e;
		}

		try {
			mkdirp.sync(path.join(this.mediaDirectoryPath, 'default', 'preset'));
		} catch(e) {
			throw 'Could not make default profile directory ' + e;
		}

		return true;
	}

	createServer() {
		let server = ws.createServer((connection) => {
			log('New client');

			connection.on('error', err => {
				logError(err);
			});


			connection.on('text', text => {
				this.parseMessage(text, connection);
			});
		});
		this.server = server;
	}

	startServer(cb) {
		this.server.listen(this.port, cb);
	}

	parseMessage(message, connection) {
		let parsed = JSON.parse(message);
		log('Received message from client: ' + message);

		if('request' in parsed) {

			switch(parsed.request) {
				case 'update':
					this.updateClients();
				break;

				case 'save-option':
					this.writeOptions(parsed.key, parsed.value);
				break;

				case 'set-folder':
					this.changeDirectory(parsed.folder);
				break;

				case 'save-preset':
					this.writePreset(parsed.name, parsed.payload, parsed.profile, connection);
				break;

				case 'save-palette':
					this.writePalette(parsed.name, parsed.payload, parsed.profile, connection);
				break;
			}
		}
	}

	changeDirectory(newPath) {
		if(this.setMediaDirectory(newPath)) {
			this._firstRun = true;
			this.watcher.close();
			this.setWatcher();
		}
	}

	setMediaDirectory(mediaDirectoryPath) {
		mediaDirectoryPath = path.normalize(mediaDirectoryPath);

		// If our options file does not contain the same path, set it
		if(mediaDirectoryPath !== this.options.mediaDirectoryPath) {
			this.writeOptions('mediaDirectoryPath', mediaDirectoryPath);
		}

		this.mediaDirectoryPath = mediaDirectoryPath;

		let seperated = mediaDirectoryPath.split(path.sep);
		this.mediaFolderName = seperated[seperated.length-1];

		return true;
	}

	setWatcher() {
		let watcher = chokidar.watch(this.mediaDirectoryPath, {
			ignored: [/(^|[\/\\])\../, '**/processed-gifs/**']
		});

		this.watcher = watcher;
		this.configureWatcher();
	}

	readOptions() {
		let options = {mediaDirectoryPath: this.mediaDirectoryPath};

		try {
			let data = fs.readFileSync(path.join(this.dataPath, 'options.json'), 'utf8');
			options = JSON.parse(data);
		} catch(err) {
			if(err.code === 'ENOENT') {
				log('Options file for Media Manager not found, creating blank');
				try {
					fs.writeFileSync(path.join(this.dataPath, 'options.json'), JSON.stringify(options));
				} catch(e) {
					logError('Could not create options.json');
					throw e;
				}
			} else {
				throw err;
			}
		}

		return options;
	}

	writeOptions(key, value) {
		this.options[key] = value;

		fs.writeFile(path.join(this.dataPath, 'options.json'), JSON.stringify(this.options), err => {
			if(err) {
				throw err;
			} else {
				return true;
			}
		});
	}

	writePreset(name, content, profile, connection) {
		log('Attempting to save Preset in profile:', profile);

		if(name.trim() === '') {
			logError('Could not save Preset, empty name');
			if(connection) {
				connection.send(JSON.stringify({
					'error': 'save-preset',
					'message': 'Could not save Preset',
					'reason': 'Empty name'
				}));
			}
			return;
		}

		if(profile.trim() === '') {
			logError('Could not save Preset, no profile');
			if(connection) {
				connection.send(JSON.stringify({
					'error': 'save-preset',
					'message': 'Could not save Preset',
					'reason': 'No profile'
				}));
			}
			return;
		}

		let outputPresetFilename = path.join(this.options.mediaDirectoryPath, profile, 'preset', name);
		outputPresetFilename += '.json';

		let dir = path.join(this.options.mediaDirectoryPath, profile, 'preset');

		mkdirp.sync(dir);

		fs.writeFile(outputPresetFilename, JSON.stringify(content), function(err) {
			if(err) {
				throw err;
			} else {
				log('Preset saved to ' + outputPresetFilename);
			}
		});
	}

	writePalette(name, content, profile, connection) {
		log('Attempting to save Palette in profile:', profile);

		if(name.trim() === '') {
			logError('Could not save Palette, empty name');
			if(connection) {
				connection.send(JSON.stringify({
					'error': 'save-palette',
					'message': 'Could not save Palette',
					'reason': 'Empty name'
				}));
			}
			return;
		}

		if(profile.trim() === '') {
			logError('Could not save Palette, no profile');
			if(connection) {
				connection.send(JSON.stringify({
					'error': 'save-palette',
					'message': 'Could not save Palette',
					'reason': 'No profile'
				}));
			}
			return;
		}

		let outputPresetFilename = path.join(this.options.mediaDirectoryPath, profile, 'palette', name);
		outputPresetFilename += '.json';

		let dir = path.join(this.options.mediaDirectoryPath, profile, 'palette');

		mkdirp.sync(dir);

		fs.writeFile(outputPresetFilename, JSON.stringify(content), function(err) {
			if(err) {
				throw err;
			} else {
				log('Palette saved to ' + outputPresetFilename);
			}
		});
	}

	getProfile(profile) {
		if(profile in this.profiles) return this.profiles[profile];
		else return false;
	}

	getOrMakeProfile(profile) {
		if(profile in this.profiles) return this.profiles[profile];
		else {

			if(profile === this.mediaFolderName) {
				throw 'Profile name cannot be the same as the media directory name (currently: ' + this.mediaFolderName + ')';
			}

			this.profiles[profile] = {
				presets: {},
				palettes:{},
				images: {},
				videos: {}
			};
			return this.profiles[profile];
		}
	}

	addProfile(profile) {
		this.profiles[profile] = {
			presets: {},
			palettes:{},
			images: {},
			videos: {}
		};

		this.sendProfileAdd({
			profile: profile
		});

		return true;
	}

	removeProfile(profile) {
		if(profile in this.profiles) {
			delete this.profiles[profile];
			this.sendProfileDelete({
				profile: profile
			});
			return true;
		} else {
			return false;
		}
	}

	updateClients() {
		this.server.connections.forEach(connection => {
			log('Sending client profiles data');
			connection.send(JSON.stringify({
				type: 'update',
				payload: this.profiles
			}));
		});
	}
}

require('./configure-watcher')(MediaManager);
require('./detect-ffmpeg')(MediaManager);
require('./parse-file')(MediaManager);
require('./send-file-add-update')(MediaManager);
require('./send-file-delete-update')(MediaManager);
require('./send-profile-delete')(MediaManager);
require('./send-profile-add')(MediaManager);

module.exports = MediaManager;