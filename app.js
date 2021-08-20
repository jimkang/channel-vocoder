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
import curry from 'lodash.curry';

var carrierBuffer;
var infoBuffer;
var labeledInfoBandpassBuffers = [];
var labeledEnvelopes = [];
var labeledCarrierBandpassBuffers = [];

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
var envelopeButton = document.getElementById('envelope-button');
var carrierChannelButton = document.getElementById('carrier-channel-button');
var modulateButton = document.getElementById('modulate-button');

channelButton.addEventListener('click', getChannelSignals);
envelopeButton.addEventListener('click', getEnvelopes);
carrierChannelButton.addEventListener('click', getCarrierChannelSignals);
modulateButton.addEventListener('click', modulateCarrierBandpasses);

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
  }
})();

function getChannelSignals() {
  bandpassCenters.forEach(
    curry(runBandpass)(
      infoBuffer,
      labeledInfoBandpassBuffers,
      '.bandpass-results',
      () => envelopeButton.classList.remove('hidden')
    )
  );
}

function getCarrierChannelSignals() {
  bandpassCenters.forEach(
    curry(runBandpass)(
      carrierBuffer,
      labeledCarrierBandpassBuffers,
      '.carrier-bandpass-results',
      () => modulateButton.classList.remove('hidden')
    )
  );
}

async function runBandpass(
  inBuffer,
  labeledBuffers,
  containerSelector,
  postRunFn,
  frequency
) {
  var { error, values } = await ep(getNewContext, {
    sampleRate: inBuffer.sampleRate,
    length: inBuffer.length,
    numberOfChannels: inBuffer.numberOfChannels,
  });
  if (error) {
    handleError(error);
    return;
  }
  var bpCtx = values[0];

  var inBufferNode = bpCtx.createBufferSource();
  inBufferNode.buffer = inBuffer;

  var bpNode = new BiquadFilterNode(bpCtx, {
    type: 'bandpass',
    Q: 0.8,
    frequency,
  });

  inBufferNode.connect(bpNode);
  bpNode.connect(bpCtx.destination);

  bpCtx.startRendering().then(onRecordingEnd).catch(handleError);
  inBufferNode.start();

  function onRecordingEnd(renderedBuffer) {
    labeledBuffers.push({ label: frequency, buffer: renderedBuffer });
    renderBuffers({
      labeledBuffers,
      containerSelector,
    });

    if (labeledBuffers.length > bandpassCenters.length - 1) {
      postRunFn();
    }
  }
}

function getEnvelopes() {
  labeledInfoBandpassBuffers.forEach(runEnvelope);
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

function modulateCarrierBandpasses() {}

function reportTopLevelError(msg, url, lineNo, columnNo, error) {
  handleError(error);
}

function renderVersion() {
  var versionInfo = document.getElementById('version-info');
  versionInfo.textContent = version;
}
