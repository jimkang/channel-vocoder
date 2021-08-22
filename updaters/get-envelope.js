import ep from 'errorback-promise';
import handleError from 'handle-error-web';
import ContextKeeper from 'audio-context-singleton';
import { renderBuffers } from '../renderers/render-buffers';
var { getNewContext } = ContextKeeper({ offline: true });
import { to } from 'await-to-js';

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

    var [efError] = await to(
      efCtx.audioWorklet.addModule('modules/envelope-follower.js')
    );
    if (efError) {
      handleError(efError);
      return;
    }

    var efNode = new AudioWorkletNode(efCtx, 'envelope-follower-processor', {
      processorOptions: {
        smoothingFactorUp,
        smoothingFactorDown,
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
}
