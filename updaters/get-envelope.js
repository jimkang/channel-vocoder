import ep from 'errorback-promise';
import handleError from 'handle-error-web';
import ContextKeeper from 'audio-context-singleton';
import { renderBuffers } from '../renderers/render-buffers';
import { connectEnvelopeGet } from '../audio-graph/connect-envelope-get';

var { getNewContext } = ContextKeeper({ offline: true });

export function GetEnvelope({
  smoothingFactorUp,
  smoothingFactorDown,
  labeledEnvelopes,
}) {
  return getEnvelope;

  async function getEnvelope({ label, buffer }) {
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

    var efCtx = values[0];
    var bufferNode = efCtx.createBufferSource();
    bufferNode.buffer = buffer;

    var efNode = await connectEnvelopeGet({
      ctx: efCtx,
      inNode: bufferNode,
      smoothingFactorUp,
      smoothingFactorDown,
      onError: handleError,
    });
    if (!efNode) {
      return;
    }

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
}
