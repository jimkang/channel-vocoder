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

  var carrierBufferNode = ctx.createBufferSource();
  carrierBufferNode.buffer = carrierBuffer;
  var infoBufferNode = ctx.createBufferSource();
  infoBufferNode.buffer = infoBuffer;

  var infoBPNodes = bandpassCenters.map((frequency) =>
    connectBandpass({ ctx, Q, frequency, inNode: infoBufferNode })
  );
  var carrierBPNodes = bandpassCenters.map((frequency) =>
    connectBandpass({ ctx, Q, frequency, inNode: carrierBufferNode })
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
  carrierBufferNode.start();
  infoBufferNode.start();

  function onRecordingEnd(renderedBuffer) {
    renderAudio({
      audioBuffer: renderedBuffer,
      containerSelector: '.result-audio',
    });
  }
}
