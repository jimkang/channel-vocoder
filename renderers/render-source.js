import { select } from 'd3-selection';
import request from 'basic-browser-request';
import bodyMover from 'request-body-mover';
import handleError from 'handle-error-web';

//var carrierFileInput = select('#carrier-file');
//var infoFileInput = select('#info-file');

export async function renderSource({ inputSelector, onBuffer, src }) {
  var arrayBuffer;
  var fileInput = select(inputSelector);
  fileInput.on('change', onFileChange);

  if (src) {
    requestBuffer(src, saveDownloadedBuffer);
  }

  function onFileChange() {
    var file = getFile(fileInput.node());
    file.arrayBuffer().then(saveFileBuffer).catch(handleError);

    function saveFileBuffer(buffer) {
      arrayBuffer = buffer;
      onBuffer(arrayBuffer);
    }
  }

  function saveDownloadedBuffer(error, buffer) {
    if (error) {
      handleError(error);
      return;
    }

    if (!arrayBuffer && buffer) {
      arrayBuffer = buffer;
      onBuffer(arrayBuffer);
    }
  }
}

function getFile(inputEl) {
  if (inputEl.files.length < 1) {
    return;
  }
  return inputEl.files[0];
}

function requestBuffer(url, done) {
  request({ url, binary: true, method: 'GET' }, bodyMover(done));
}
