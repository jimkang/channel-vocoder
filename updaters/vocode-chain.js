import ep from 'errorback-promise';
import handleError from 'handle-error-web';
import ContextKeeper from 'audio-context-singleton';
import { renderAudio } from 'render-audio';
import { connectEnvelopeApply } from '../audio-graph/connect-envelope-apply';
import { connectEnvelopeGet } from '../audio-graph/connect-envelope-get';
import { connectBandpass } from '../audio-graph/connect-bandpass';
import { to } from 'await-to-js';

var { getNewContext } = ContextKeeper({ offline: true });

export async function runVocodeChain({
  Q,
  smoothingFactorUp,
  smoothingFactorDown,
  bandpassCenters,
  carrierBuffer,
  infoBuffer,
  carrierSrc,
  infoSrc,
  carrierLevel,
  infoLevel,
}) {
  var { error, values } = await ep(getNewContext, {
    sampleRate: carrierBuffer.sampleRate,
    length: carrierBuffer.length,
    numberOfChannels: carrierBuffer.numberOfChannels,
  });
  if (error) {
    handleError(error);
    return;
  }

  var ctx = values[0];

  var inCarrierNode;
  var inInfoNode;

  if (carrierSrc) {
    inCarrierNode = new MediaElementAudioSourceNode(ctx, {
      mediaElement: new Audio(carrierSrc),
    });
  } else {
    inCarrierNode = ctx.createBufferSource();
    inCarrierNode.buffer = carrierBuffer;
  }
  if (infoSrc) {
    inInfoNode = new MediaElementAudioSourceNode(ctx, {
      mediaElement: new Audio(infoSrc),
    });
  } else {
    inInfoNode = ctx.createBufferSource();
    inInfoNode.buffer = infoBuffer;
  }

  var infoBPNodes = bandpassCenters.map((frequency) =>
    connectBandpass({ ctx, Q, frequency, inNode: inInfoNode })
  );
  var carrierBPNodes = bandpassCenters.map((frequency) =>
    connectBandpass({ ctx, Q, frequency, inNode: inCarrierNode })
  );

  var [envGetError, envelopeGetNodes] = await to(
    Promise.all(
      infoBPNodes.map((bpNode) =>
        connectEnvelopeGet({
          inNode: bpNode,
          ctx,
          smoothingFactorDown,
          smoothingFactorUp,
          onError: handleError,
        })
      )
    )
  );
  if (envGetError) {
    handleError(envGetError);
    return;
  }

  var modulatedNodes = carrierBPNodes.map((bpNode, i) =>
    connectEnvelopeApply({
      ctx,
      inCarrierNode: bpNode,
      inEnvelopeNode: envelopeGetNodes[i],
      carrierLevel,
      envLevel: infoLevel,
    })
  );

  modulatedNodes.forEach((node) => node.connect(ctx.destination));
  ctx.startRendering().then(onRecordingEnd).catch(handleError);
  inCarrierNode.start();
  inInfoNode.start();

  function onRecordingEnd(renderedBuffer) {
    renderAudio({
      audioBuffer: renderedBuffer,
      containerSelector: '.result-audio',
    });
  }
}
