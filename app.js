import handleError from 'handle-error-web';
import { version } from './package.json';
import ep from 'errorback-promise';
import { renderSources } from './renderers/render-sources';
import { renderAudio } from 'render-audio';
import ContextKeeper from 'audio-context-singleton';
import { decodeArrayBuffer } from './tasks/decode-array-buffer';
import { queue } from 'd3-queue';
import { renderBuffers } from './renderers/render-buffers';
import { to } from 'await-to-js';

var carrierBuffer;
var infoBuffer;
var bandpassBuffersForFreqs = {};
var labeledEnvelopes = [];

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
var envelopeButton = document.getElementById('envelope-button');
envelopeButton.addEventListener('click', getEnvelopes);

var { getNewContext } = ContextKeeper({ offline: true });

(async function go() {
  window.onerror = reportTopLevelError;
  renderVersion();

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
})();

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

    var labeledBuffers = getLabeledBuffers();
    renderBuffers({
      labeledBuffers,
      containerSelector: '.bandpass-results',
    });

    if (labeledBuffers.length > 9) {
      envelopeButton.classList.remove('hidden');
    }
  }
}

function getEnvelopes() {
  var labeledBuffers = getLabeledBuffers();
  labeledBuffers.forEach(runEnvelope);
}

async function runEnvelope({ label, buffer }) {
  // TODO: Factor this out.
  var { error, values } = await ep(getNewContext, {
    sampleRate: buffer.sampleRate,
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
  });
  if (error) {
    handleError(error);
    return;
  }

  labeledEnvelopes.length = 0;

  var efCtx = values[0];
  var bufferNode = efCtx.createBufferSource();
  bufferNode.buffer = buffer;

  var [efError] = await to(
    efCtx.audioWorklet.addModule('modules/envelope-follower.js')
  );
  if (efError) {
    handleError(efError);
    return;
  }

  var efNode = new AudioWorkletNode(
    efCtx,
    'envelope-follower-processor',
    { processorOptions: { smoothingFactor: 0.8 } } // +smoothingField.value } }
  );
  bufferNode.connect(efNode);
  efNode.connect(efCtx.destination);

  efCtx.startRendering().then(onRecordingEnd).catch(handleError);
  bufferNode.start();

  function onRecordingEnd(renderedBuffer) {
    labeledEnvelopes.push({ label, buffer: renderedBuffer });

    renderBuffers({
      labeledBuffers: labeledEnvelopes,
      containerSelector: '.envelopes',
    });
  }
}

function getLabeledBuffers() {
  var labeledBuffers = [];

  for (var freq in bandpassBuffersForFreqs) {
    labeledBuffers.push({
      label: freq,
      buffer: bandpassBuffersForFreqs[freq],
    });
  }

  return labeledBuffers;
}

function reportTopLevelError(msg, url, lineNo, columnNo, error) {
  handleError(error);
}

function renderVersion() {
  var versionInfo = document.getElementById('version-info');
  versionInfo.textContent = version;
}
