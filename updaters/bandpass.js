import ep from 'errorback-promise';
import handleError from 'handle-error-web';
import ContextKeeper from 'audio-context-singleton';
import { renderBuffers } from '../renderers/render-buffers';

var { getNewContext } = ContextKeeper({ offline: true });
export function Bandpass({
  inBuffer,
  labeledBuffers,
  containerSelector,
  Q,
  bandpassCenters,
  postRunFn,
}) {
  return runBandpass;

  async function runBandpass(frequency) {
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
      Q,
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
}
