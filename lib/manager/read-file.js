import fs from 'fs';
import path from 'path';
import log from './log';
import store from '../store';

export default function readFile(filePath) {
  const relativePath = filePath.replace(this.mediaDirectoryPath, '');
  const parsed = path.parse(relativePath);

  const seperated = relativePath.split(path.sep);
  const project = seperated[1];
  const folder = seperated[2];

  const fileType = parsed.ext.replace('.', '').toLowerCase();
  const fileName = parsed.name;

  const handlers = store.getters['readHandlers/forFileType'](folder, fileType);
  if (!handlers || !handlers.length) return;

  handlers.forEach(async (handler) => {
    const file = fs.createReadStream(filePath, { encoding: 'utf8' });

    const processResult = await handler.process({
      file,
      fileName,
      fileType,
    }, {
      getStream: () => {},
      log,
    });

    if (processResult && typeof processResult === 'boolean') {
      store.dispatch('media/addMedia', {
        project,
        folder,
        item: {
          name: fileName,
          path: filePath,
        },
      });
    } else if (processResult && typeof processResult === 'object') {
      console.log('add this file in a different way');
    }
  });
}
