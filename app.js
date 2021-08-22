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
import { Bandpass } from './updaters/bandpass';

var debug = true;

var carrierBuffer;
var infoBuffer;
var labeledInfoBandpassBuffers = [];
var labeledEnvelopes = [];
var labeledCarrierBandpassBuffers = [];
var labeledModulatedBuffers = [];

// https://patentimages.storage.googleapis.com/29/15/cf/13438f97b5d58c/US2121142.pdf
var bandpassCenters = [
  //112.5,
  337.5,
  575,
  850,
  1200,
  1700,
  2350,
  //3250,
  //4600,
  //6450,
];

var channelButton = document.getElementById('channel-button');
var envelopeButton = document.getElementById('envelope-button');
var carrierChannelButton = document.getElementById('carrier-channel-button');
var modulateButton = document.getElementById('modulate-button');
var mergeButton = document.getElementById('merge-button');
var carrierLevelInput = document.getElementById('carrier-level');
var infoLevelInput = document.getElementById('info-level');
var smoothingUpInput = document.getElementById('smoothing-factor-up');
var smoothingDownInput = document.getElementById('smoothing-factor-down');
var qInput = document.getElementById('q-val');

channelButton.addEventListener('click', getChannelSignals);
envelopeButton.addEventListener('click', getEnvelopes);
carrierChannelButton.addEventListener('click', getCarrierChannelSignals);
modulateButton.addEventListener('click', modulateCarrierBandpasses);
mergeButton.addEventListener('click', mergeModulated);

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
    debug ? channelButton.click() : null;
  }
})();

function getChannelSignals() {
  bandpassCenters.forEach(
    Bandpass({
      Q: +qInput.value,
      bandpassCenters,
      inBuffer: infoBuffer,
      labeledBuffers: labeledInfoBandpassBuffers,
      containerSelector: '.bandpass-results',
      postRunFn: () => envelopeButton.classList.remove('hidden'),
    })
  );
}

function getCarrierChannelSignals() {
  bandpassCenters.forEach(
    Bandpass({
      Q: +qInput.value,
      bandpassCenters,
      inBuffer: carrierBuffer,
      labeledBuffers: labeledCarrierBandpassBuffers,
      containerSelector: '.carrier-bandpass-results',
      postRunFn: () => modulateButton.classList.remove('hidden'),
    })
  );
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

  var efNode = new AudioWorkletNode(efCtx, 'envelope-follower-processor', {
    processorOptions: {
      smoothingFactorUp: +smoothingUpInput.value,
      smoothingFactorDown: +smoothingDownInput.value,
    },
  });
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

function modulateCarrierBandpasses() {
  labeledCarrierBandpassBuffers.forEach(runMultiply);
}

async function runMultiply({ label, buffer }) {
  var baseBuffer = buffer;
  var { error, values } = await ep(getNewContext, {
    sampleRate: baseBuffer.sampleRate,
    length: baseBuffer.length,
    numberOfChannels: baseBuffer.numberOfChannels,
  });
  if (error) {
    handleError(error);
    return;
  }

  labeledModulatedBuffers.length = 0;

  var mCtx = values[0];
  var bufferNode = mCtx.createBufferSource();
  bufferNode.buffer = baseBuffer;

  var labeledEnvelope = labeledEnvelopes.find(
    (labeledEnv) => labeledEnv.label === label
  );
  if (!labeledEnvelope) {
    throw new Error(`Could not find envelope for ${label}`);
  }

  var envelopeNode = mCtx.createBufferSource();
  envelopeNode.buffer = labeledEnvelope.buffer;

  var mNode = new GainNode(mCtx);
  var carrierAmpNode = new GainNode(mCtx);
  carrierAmpNode.gain.value = +carrierLevelInput.value;
  var infoAmpNode = new GainNode(mCtx);
  // Why??
  infoAmpNode.gain.value = -1.0 * +infoLevelInput.value;

  bufferNode.connect(carrierAmpNode);
  carrierAmpNode.connect(mNode);
  envelopeNode.connect(infoAmpNode);
  infoAmpNode.connect(mNode.gain);
  mNode.connect(mCtx.destination);

  mCtx.startRendering().then(onRecordingEnd).catch(handleError);
  bufferNode.start();
  envelopeNode.start();

  function onRecordingEnd(renderedBuffer) {
    labeledModulatedBuffers.push({ label, buffer: renderedBuffer });

    renderBuffers({
      labeledBuffers: labeledModulatedBuffers,
      containerSelector: '.modulated-carrier-bandpasses',
    });
    mergeButton.classList.remove('hidden');

    debug ? mergeButton.click() : null;
  }
}

async function mergeModulated() {
  if (labeledModulatedBuffers.length < 2) {
    return;
  }

  var firstBuffer = labeledModulatedBuffers[0].buffer;
  var { error, values } = await ep(getNewContext, {
    sampleRate: firstBuffer.sampleRate,
    length: firstBuffer.length,
    numberOfChannels: firstBuffer.numberOfChannels,
  });
  if (error) {
    handleError(error);
    return;
  }

  var mCtx = values[0];
  var srcNodes = labeledModulatedBuffers.map(
    (lb) => new AudioBufferSourceNode(mCtx, { buffer: lb.buffer })
  );
  srcNodes.forEach((node) => node.connect(mCtx.destination));

  mCtx.startRendering().then(onRecordingEnd).catch(handleError);
  srcNodes.forEach((node) => node.start());

  function onRecordingEnd(renderedBuffer) {
    renderAudio({
      audioBuffer: renderedBuffer,
      containerSelector: '.result-audio',
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
