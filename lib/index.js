const chokidar = require('chokidar');
const fs = require('fs');
const log = require('./log');
const logError = require('./logError');
const mkdirp = require('mkdirp');
const path = require('path');
const ospath = require('ospath');
const ws = require('nodejs-websocket');
const express = require('express');
const os = require('os');

class MediaManager {
  constructor(port, autoDownload) {
    this.port = port;

    /* Viable file formats */
    this.viable = {
      video: {
        mp4: true,
        m4v: true,
        webm: true,
        ogv: true,
      },
      image: {
        jpg: true,
        jpeg: true,
        png: true,
        gif: true,
      },
    };

    this.server = null;
    this.fileServer = null;
    this.fileServerApp = null;
    this.watcher = null;
    this.profiles = {};
    this.firstRun = true;

    this.makeDataDirectory();

    this.mediaDirectoryPath = path.join(this.dataPath, 'media');

    this.makeDefaultProfile();

    this.mediaFolderName = 'media';

    this.options = this.readOptions();
    this.setMediaDirectory(this.options.mediaDirectoryPath || this.mediaDirectoryPath);

    this.createServer();

    this.detectFfmpeg((ffmpegPath) => {
      log(ffmpegPath);
      this.ffmpegPath = ffmpegPath;
      this.startServer(() => {
        log('👌  MediaManager started on ports', this.port, 'and 3133');
        this.setWatcher();
      });
    }, autoDownload);
  }

  get dataPath() { //eslint-disable-line
    return path.join(ospath.data(), 'modV');
  }

  makeDataDirectory() {
    try {
      mkdirp.sync(this.dataPath);
    } catch (e) {
      throw new Error(`Could not make data directory ${e}`);
    }

    return true;
  }

  makeDefaultProfile() {
    return this.makeProfile('default');
  }

  makeProfile(profileName) {
    try {
      mkdirp.sync(path.join(this.mediaDirectoryPath, profileName));
    } catch (e) {
      throw new Error(`Could not make "${profileName}" profile directory ${e}`);
    }

    try {
      mkdirp.sync(path.join(this.mediaDirectoryPath, profileName, 'image'));
    } catch (e) {
      throw new Error(`Could not make "${profileName}" profile image directory ${e}`);
    }

    try {
      mkdirp.sync(path.join(this.mediaDirectoryPath, profileName, 'video'));
    } catch (e) {
      throw new Error(`Could not make "${profileName}" profile video directory ${e}`);
    }

    try {
      mkdirp.sync(path.join(this.mediaDirectoryPath, profileName, 'palette'));
    } catch (e) {
      throw new Error(`Could not make "${profileName}" profile palette directory ${e}`);
    }

    try {
      mkdirp.sync(path.join(this.mediaDirectoryPath, profileName, 'preset'));
    } catch (e) {
      throw new Error(`Could not make "${profileName}" profile preset directory ${e}`);
    }

    try {
      mkdirp.sync(path.join(this.mediaDirectoryPath, profileName, 'module'));
    } catch (e) {
      throw new Error(`Could not make "${profileName}" profile module directory ${e}`);
    }

    try {
      mkdirp.sync(path.join(this.mediaDirectoryPath, profileName, 'plugin'));
    } catch (e) {
      throw new Error(`Could not make "${profileName}" profile plugin directory ${e}`);
    }

    try {
      mkdirp.sync(path.join(this.mediaDirectoryPath, profileName, 'plugin_data'));
    } catch (e) {
      throw new Error(`Could not make "${profileName}" profile plug_data directory ${e}`);
    }

    return true;
  }

  createFileServer() {
    if (this.fileServer) {
      this.fileServer.close();
    }

    this.fileServerApp = express();
    this.fileServerApp.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
    this.fileServerApp.use(express.static(this.mediaDirectoryPath));
    this.fileServer = this.fileServerApp.listen(3133);
  }

  createServer() {
    this.createFileServer();

    const server = ws.createServer((connection) => {
      log('New client');

      connection.on('error', err => logError(err));
      connection.on('text', text => this.parseMessage(text, connection));
    });
    this.server = server;
  }

  startServer(cb) {
    this.server.listen(this.port, cb);
  }

  parseMessage(message, connection) {
    const parsed = JSON.parse(message);
    log(`Received message from client: ${message}`);

    if ('request' in parsed) {
      switch (parsed.request) {
        default:
          break;

        case 'update':
          this.updateClients();
          break;

        case 'save-option':
          this.writeOptions(parsed.key, parsed.value);
          break;

        case 'set-folder':
          this.changeDirectory(parsed.folder);
          break;

        case 'make-profile':
          if (this.makeProfile(parsed.profileName)) {
            this.getOrMakeProfile(parsed.profileName);
            this.updateClients();
          }
          break;

        case 'save-preset':
          this.writePreset(parsed.name, parsed.payload, parsed.profile, connection);
          break;

        case 'save-palette':
          this.writePalette(parsed.name, parsed.payload, parsed.profile, connection);
          break;

        case 'save-plugin':
          this.writePlugin(parsed.name, parsed.payload, parsed.profile, connection);
          break;
      }
    }
  }

  changeDirectory(newPath) {
    if (this.setMediaDirectory(newPath)) {
      this.firstRun = true;
      this.watcher.close();
      this.setWatcher();
    }
  }

  setMediaDirectory(mediaDirectoryPathIn) {
    const mediaDirectoryPath = path.normalize(mediaDirectoryPathIn);

    // If our options file does not contain the same path, set it
    if (mediaDirectoryPath !== this.options.mediaDirectoryPath) {
      this.writeOptions('mediaDirectoryPath', mediaDirectoryPath);
    }

    this.mediaDirectoryPath = mediaDirectoryPath;

    const seperated = mediaDirectoryPath.split(path.sep);
    this.mediaFolderName = seperated[seperated.length - 1];

    this.createFileServer();

    return true;
  }

  setWatcher() {
    const watcher = chokidar.watch(this.mediaDirectoryPath, {
      ignored: [
        os.platform() === 'darwin' ? /(^|[/\\])\../ : undefined,
        '**/processed-gifs/**',
        /node_modules/,
        '**/package.json',
        '**/package-lock.json',
        /module\/compiled/,
      ],
    });

    this.watcher = watcher;
    this.configureWatcher();
  }

  readOptions() {
    let options = { mediaDirectoryPath: this.mediaDirectoryPath };

    try {
      const data = fs.readFileSync(path.join(this.dataPath, 'options.json'), 'utf8');
      options = JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        log('Options file for Media Manager not found, creating blank');

        try {
          fs.writeFileSync(path.join(this.dataPath, 'options.json'), JSON.stringify(options));
        } catch (e) {
          logError('Could not create options.json');
          throw new Error(e);
        }
      } else {
        throw new Error(err);
      }
    }

    return options;
  }

  writeOptions(key, value) {
    this.options[key] = value;

    fs.writeFile(path.join(this.dataPath, 'options.json'), JSON.stringify(this.options), (err) => {
      if (err) {
        throw new Error(err);
      } else {
        return true;
      }
    });
  }

  writePreset(name, content, profile, connection) {
    log('Attempting to save Preset in profile:', profile);

    if (name.trim() === '') {
      logError('Could not save Preset, empty name');
      if (connection) {
        connection.send(JSON.stringify({
          error: 'save-preset',
          message: 'Could not save Preset',
          reason: 'Empty name',
        }));
      }
      return;
    }

    if (profile.trim() === '') {
      logError('Could not save Preset, no profile');
      if (connection) {
        connection.send(JSON.stringify({
          error: 'save-preset',
          message: 'Could not save Preset',
          reason: 'No profile',
        }));
      }
      return;
    }

    let outputPresetFilename = path.join(this.options.mediaDirectoryPath, profile, 'preset', name);
    outputPresetFilename += '.json';

    const dir = path.join(this.options.mediaDirectoryPath, profile, 'preset');

    mkdirp.sync(dir);

    fs.writeFile(outputPresetFilename, JSON.stringify(content), (err) => {
      if (err) {
        throw new Error(err);
      } else {
        log(`Preset saved to ${outputPresetFilename}`);
      }
    });
  }

  writePlugin(name, content, profile, connection) {
    log('Attempting to save Plugin in profile:', profile);

    if (name.trim() === '') {
      logError('Could not save Plugin, empty name');
      if (connection) {
        connection.send(JSON.stringify({
          error: 'save-plugin',
          message: 'Could not save Plugin',
          reason: 'Empty name',
        }));
      }
      return;
    }

    if (profile.trim() === '') {
      logError('Could not save Plugin, no profile');
      if (connection) {
        connection.send(JSON.stringify({
          error: 'save-plugin',
          message: 'Could not save Plugin',
          reason: 'No profile',
        }));
      }
      return;
    }

    let outputPresetFilename = path.join(this.options.mediaDirectoryPath, profile, 'plugin', name);
    outputPresetFilename += '.json';

    const dir = path.join(this.options.mediaDirectoryPath, profile, 'plugin');

    mkdirp.sync(dir);

    fs.writeFile(outputPresetFilename, JSON.stringify(content), (err) => {
      if (err) {
        throw new Error(err);
      } else {
        log(`Plugin saved to ${outputPresetFilename}`);
      }
    });
  }

  writePalette(name, content, profile, connection) {
    log('Attempting to save Palette in profile:', profile);

    if (name.trim() === '') {
      logError('Could not save Palette, empty name');
      if (connection) {
        connection.send(JSON.stringify({
          error: 'save-palette',
          message: 'Could not save Palette',
          reason: 'Empty name',
        }));
      }
      return;
    }

    if (profile.trim() === '') {
      logError('Could not save Palette, no profile');
      if (connection) {
        connection.send(JSON.stringify({
          error: 'save-palette',
          message: 'Could not save Palette',
          reason: 'No profile',
        }));
      }
      return;
    }

    let outputPresetFilename = path.join(this.options.mediaDirectoryPath, profile, 'palette', name);
    outputPresetFilename += '.json';

    const dir = path.join(this.options.mediaDirectoryPath, profile, 'palette');

    mkdirp.sync(dir);

    fs.writeFile(outputPresetFilename, JSON.stringify(content), (err) => {
      if (err) {
        throw new Error(err);
      } else {
        log(`Palette saved to ${outputPresetFilename}`);
      }
    });
  }

  getProfile(profile) {
    if (profile in this.profiles) return this.profiles[profile];
    return false;
  }

  getOrMakeProfile(profile) {
    if (profile in this.profiles) return this.profiles[profile];


    if (profile === this.mediaFolderName) {
      throw new Error(`Profile name cannot be the same as the media directory name (currently: ${this.mediaFolderName})`);
    }

    this.profiles[profile] = {
      presets: {},
      palettes: {},
      images: {},
      videos: {},
      modules: {},
      plugins: {},
      plugin_data: {},
    };
    return this.profiles[profile];
  }

  addProfile(profile) {
    this.profiles[profile] = {
      presets: {},
      palettes: {},
      images: {},
      videos: {},
      modules: {},
      plugins: {},
      plugin_data: {},
    };

    this.sendProfileAdd({
      profile,
    });

    return true;
  }

  removeProfile(profile) {
    if (profile in this.profiles) {
      delete this.profiles[profile];
      this.sendProfileDelete({
        profile,
      });
      return true;
    }
    return false;
  }

  updateClients() {
    this.server.connections.forEach((connection) => {
      log('Sending client profiles data');
      connection.send(JSON.stringify({
        type: 'update',
        payload: this.profiles,
      }));
    });
  }
}

require('./compile-module')(MediaManager);
require('./configure-watcher')(MediaManager);
require('./detect-ffmpeg')(MediaManager);
require('./parse-file')(MediaManager);
require('./send-file-add-update')(MediaManager);
require('./send-file-delete-update')(MediaManager);
require('./send-profile-delete')(MediaManager);
require('./send-profile-add')(MediaManager);

module.exports = MediaManager;
