import RouteState from 'route-state';
import handleError from 'handle-error-web';
import { version } from './package.json';
import ep from 'errorback-promise';
import { renderSources } from './renderers/render-sources';
import { renderAudio } from 'render-audio';
import ContextKeeper from 'audio-context-singleton';
import { decodeArrayBuffer } from './tasks/decode-array-buffer';
import { queue } from 'd3-queue';
import { renderBuffers } from './renderers/render-buffers';

var routeState;
var carrierBuffer;
var infoBuffer;
var bandpassBuffersForFreqs = {};

// https://patentimages.storage.googleapis.com/29/15/cf/13438f97b5d58c/US2121142.pdf
var bandpassCenters = [
  112.5,
  337.5,
  575,
  850,
  1200,
  1700,
  2350,
  3250,
  4600,
  6450,
];

var channelButton = document.getElementById('channel-button');
channelButton.addEventListener('click', getChannelSignals);

var { getNewContext } = ContextKeeper({ offline: true });

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

    carrierBuffer = audioBuffers[0];
    infoBuffer = audioBuffers[1];

    renderAudio({
      audioBuffer: carrierBuffer,
      containerSelector: '.file1-audio',
    });
    renderAudio({
      audioBuffer: infoBuffer,
      containerSelector: '.file2-audio',
    });

    channelButton.classList.remove('hidden');

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

function getChannelSignals() {
  bandpassCenters.forEach(runBandpass);
}

async function runBandpass(frequency) {
  var { error, values } = await ep(getNewContext, {
    sampleRate: infoBuffer.sampleRate,
    length: infoBuffer.length,
    numberOfChannels: infoBuffer.numberOfChannels,
  });
  if (error) {
    handleError(error);
    return;
  }
  var bpCtx = values[0];

  var infoBufferNode = bpCtx.createBufferSource();
  infoBufferNode.buffer = infoBuffer;

  var bpNode = new BiquadFilterNode(bpCtx, {
    type: 'bandpass',
    Q: 0.8,
    frequency,
  });

  infoBufferNode.connect(bpNode);
  bpNode.connect(bpCtx.destination);

  bpCtx.startRendering().then(onRecordingEnd).catch(handleError);
  infoBufferNode.start();

  function onRecordingEnd(renderedBuffer) {
    bandpassBuffersForFreqs[frequency] = renderedBuffer;
    var labeledBuffers = [];

    for (var freq in bandpassBuffersForFreqs) {
      labeledBuffers.push({
        label: freq,
        buffer: bandpassBuffersForFreqs[freq],
      });
    }

    renderBuffers({
      labeledBuffers,
      containerSelector: '.bandpass-results',
    });
  }
}

function reportTopLevelError(msg, url, lineNo, columnNo, error) {
  handleError(error);
}

function renderVersion() {
  var versionInfo = document.getElementById('version-info');
  versionInfo.textContent = version;
}
