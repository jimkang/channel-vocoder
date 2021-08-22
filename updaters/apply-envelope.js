import ep from 'errorback-promise';
import handleError from 'handle-error-web';
import ContextKeeper from 'audio-context-singleton';
import { renderBuffers } from '../renderers/render-buffers';
import { connectEnvelopeApply } from '../audio-graph/connect-envelope-apply';

var { getNewContext } = ContextKeeper({ offline: true });

export function ApplyEnvelope({
  labeledModulatedBuffers,
  labeledEnvelopes,
  carrierLevel,
  infoLevel,
  postRunFn,
}) {
  return applyEnvelope;

  async function applyEnvelope({ label, buffer }) {
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

    var mNode = connectEnvelopeApply({
      ctx: mCtx,
      inCarrierNode: bufferNode,
      inEnvelopeNode: envelopeNode,
      carrierLevel,
      envLevel: infoLevel,
    });
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

      postRunFn();
    }
  }
}
