import RouteState from 'route-state';
import handleError from 'handle-error-web';
import { version } from './package.json';
import ep from 'errorback-promise';
import { renderSources } from './renderers/render-sources';
import { renderResultAudio } from './renderers/render-result-audio';
import ContextKeeper from 'audio-context-singleton';
import { decodeArrayBuffer } from './tasks/decode-array-buffer';
import { queue } from 'd3-queue';

var routeState;
var { getCurrentContext } = ContextKeeper();

(async function go() {
  window.onerror = reportTopLevelError;
  renderVersion();

  routeState = RouteState({
    followRoute,
    windowObject: window,
  });
  routeState.routeFromHash();
})();

async function followRoute() {
  var { error, values } = await ep(getCurrentContext);
  if (error) {
    handleError(error);
    return;
  }

  var ctx = values[0];

  renderSources({ onBuffers });

  async function onBuffers(buffers) {
    if (buffers.length < 2) {
      return;
    }

    var q = queue();
    buffers.forEach((buffer) => q.defer(decodeArrayBuffer, buffer));
    q.awaitAll(useAudioBuffers);
  }

  function useAudioBuffers(error, audioBuffers) {
    if (error) {
      handleError(error);
      return;
    }

    renderResultAudio({
      audioBuffer: audioBuffers[0],
      containerSelector: '.file1-audio',
    });
    renderResultAudio({
      audioBuffer: audioBuffers[1],
      containerSelector: '.file2-audio',
    });

    //var combinedBuffer =
    //channel -
    //vcdrBuffers({
    //ctx,
    //audioBuffers,
    //preserveTempo,
    //samplesPerChunk: +samplesPerChunk,
    //});
    //console.log('Combined buffer', combinedBuffer);
    //
    //renderResultAudio({ audioBuffer: combinedBuffer,
    //containerSelector: '.result-audio',
    //});
  }
}

function reportTopLevelError(msg, url, lineNo, columnNo, error) {
  handleError(error);
}

function renderVersion() {
  var versionInfo = document.getElementById('version-info');
  versionInfo.textContent = version;
}
