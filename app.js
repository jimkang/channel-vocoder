import handleError from 'handle-error-web';
import { version } from './package.json';
import ep from 'errorback-promise';
import { renderSources } from './renderers/render-sources';
import { renderAudio } from 'render-audio';
import ContextKeeper from 'audio-context-singleton';
import { decodeArrayBuffer } from './tasks/decode-array-buffer';
import { queue } from 'd3-queue';
import { Bandpass } from './updaters/bandpass';
import { GetEnvelope } from './updaters/get-envelope';
import { ApplyEnvelope } from './updaters/apply-envelope';
import RouteState from 'route-state';
import { runVocodeChain } from './updaters/vocode-chain';
import { connectBufferMergerToDest } from './audio-graph/connect-merger';

var debug = true;
var routeState;
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
var vocodeButton = document.getElementById('vocode-button');

channelButton.addEventListener('click', getChannelSignals);
envelopeButton.addEventListener('click', getEnvelopes);
carrierChannelButton.addEventListener('click', getCarrierChannelSignals);
modulateButton.addEventListener('click', modulateCarrierBandpasses);
mergeButton.addEventListener('click', mergeModulated);
vocodeButton.addEventListener('click', onVocodeClick);

var { getNewContext } = ContextKeeper({ offline: true });

(async function go() {
  window.onerror = reportTopLevelError;
  renderVersion();
  routeState = RouteState({
    followRoute,
    windowObject: window,
    propsToCoerceToBool: ['nonstop'],
  });
  routeState.routeFromHash();
})();

async function followRoute({ nonstop }) {
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

    if (nonstop) {
      vocodeButton.classList.remove('hidden');
    } else {
      channelButton.classList.remove('hidden');
      carrierChannelButton.classList.remove('hidden');
      debug ? channelButton.click() : null;
    }
  }
}

function getChannelSignals() {
  var runInfoBandpass = Bandpass({
    Q: +qInput.value,
    bandpassCenters,
    inBuffer: infoBuffer,
    labeledBuffers: labeledInfoBandpassBuffers,
    containerSelector: '.bandpass-results',
    postRunFn: () => envelopeButton.classList.remove('hidden'),
  });
  bandpassCenters.forEach(runInfoBandpass);
}

function getCarrierChannelSignals() {
  var runCarrierBandpass = Bandpass({
    Q: +qInput.value,
    bandpassCenters,
    inBuffer: carrierBuffer,
    labeledBuffers: labeledCarrierBandpassBuffers,
    containerSelector: '.carrier-bandpass-results',
    postRunFn: () => modulateButton.classList.remove('hidden'),
  });

  bandpassCenters.forEach(runCarrierBandpass);
}

function getEnvelopes() {
  labeledEnvelopes.length = 0;
  labeledInfoBandpassBuffers.forEach(
    GetEnvelope({
      labeledEnvelopes,
      smoothingFactorUp: +smoothingUpInput.value,
      smoothingFactorDown: +smoothingDownInput.value,
    })
  );
}

function modulateCarrierBandpasses() {
  labeledModulatedBuffers.length = 0;
  var applyEnvelope = ApplyEnvelope({
    labeledModulatedBuffers,
    labeledEnvelopes,
    carrierLevel: +carrierLevelInput.value,
    infoLevel: +infoLevelInput.value,
    postRunFn() {
      if (labeledModulatedBuffers.length > bandpassCenters.length - 1) {
        mergeButton.classList.remove('hidden');
        debug ? mergeButton.click() : null;
      }
    },
  });
  labeledCarrierBandpassBuffers.forEach(applyEnvelope);
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
  var srcNodes = connectBufferMergerToDest({
    ctx: mCtx,
    inBuffers: labeledModulatedBuffers.map((lb) => lb.buffer),
  });

  mCtx.startRendering().then(onRecordingEnd).catch(handleError);
  srcNodes.forEach((node) => node.start());

  function onRecordingEnd(renderedBuffer) {
    renderAudio({
      audioBuffer: renderedBuffer,
      containerSelector: '.result-audio',
    });
  }
}

function onVocodeClick() {
  runVocodeChain({
    Q: +qInput.value,
    smoothingFactorUp: +smoothingUpInput.value,
    smoothingFactorDown: +smoothingDownInput.value,
    bandpassCenters,
    carrierBuffer,
    infoBuffer,
    carrierLevel: +carrierLevelInput.value,
    infoLevel: +infoLevelInput.value,
  });
}

function reportTopLevelError(msg, url, lineNo, columnNo, error) {
  handleError(error);
}

function renderVersion() {
  var versionInfo = document.getElementById('version-info');
  versionInfo.textContent = version;
}
