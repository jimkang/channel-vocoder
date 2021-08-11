import handleError from 'handle-error-web';

export function respondToFileChanges({ files, onBuffers }) {
  var bufferPromises = files.map((file) => file.arrayBuffer());
  Promise.all(bufferPromises).then(onBuffers).catch(handleError);
}
