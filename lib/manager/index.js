import path from 'path';
import ospath from 'ospath';

import store from '../store';

import { log } from './log';

import addReadHandler from './add-read-handler';
import createWsServer from './create-ws-server';
import createHttpServer from './create-http-server';
import createWatcher from './create-watcher';
import readFile from './read-file';
import parseMessage from './parse-message';

import imageHandler from '../read-handlers/image';
import paletteHandler from '../read-handlers/palette';
import presetHandler from '../read-handlers/preset';

export default class MediaManager {
  /* eslint-disable class-methods-use-this */

  addReadHandler = addReadHandler;
  createWatcher = createWatcher;
  createWsServer = createWsServer;
  createHttpServer = createHttpServer;
  readFile = readFile;
  parseMessage = parseMessage;

  get dataPath() {
    return path.join(ospath.data(), 'modV');
  }

  get mediaDirectoryPath() {
    return path.join(this.dataPath, 'media');
  }

  constructor(options) {
    const defaults = {
      wsPort: 3132,
      httpPort: 3133,
      mediaFolderName: 'media',
    };

    Object.assign(this, defaults, options);

    this.addReadHandler({ readHandler: imageHandler });
    this.addReadHandler({ readHandler: paletteHandler });
    this.addReadHandler({ readHandler: presetHandler });
  }

  async start() {
    store.subscribe((mutation) => {
      if (mutation.type.split('/')[0] !== 'media') return;
      this.broadcast(JSON.stringify(mutation));
    });

    await this.createServers();
    await this.createWatcher();
  }

  createServers() {
    return new Promise((resolve) => {
      this.wsServer = this.createWsServer();
      this.wsServer.listen(this.wsPort, () => {
        log(`WebSocket server running on port ${this.wsPort}`);

        const httpServer = this.createHttpServer();
        this.httpServer = httpServer.listen(this.httpPort, () => {
          log(`HTTP server running on port ${this.httpPort}`);

          resolve();
        });
      });
    });
  }

  broadcast(data) {
    if (!this.wsServer) return;

    this.wsServer.connections.forEach(connection => connection.send(data));
  }
}

const mm = new MediaManager();
mm.start();
