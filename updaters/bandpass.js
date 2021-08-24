import ep from 'errorback-promise';
import handleError from 'handle-error-web';
import ContextKeeper from 'audio-context-singleton';
import { renderBuffers } from '../renderers/render-buffers';
import { connectBandpass } from '../audio-graph/connect-bandpass';

var { getNewContext } = ContextKeeper({ offline: true });
export function Bandpass({
  inBuffer,
  inSrc,
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
    var inNode;

    if (inSrc) {
      var audioEl = new Audio(inSrc);
      inNode = new MediaElementAudioSourceNode(bpCtx, {
        mediaElement: audioEl,
      });
    } else if (inBuffer) {
      inNode = bpCtx.createBufferSource();
      inNode.buffer = inBuffer;
    }

    var bpNode = connectBandpass({
      ctx: bpCtx,
      Q,
      frequency,
      inNode,
    });

    bpNode.connect(bpCtx.destination);

    bpCtx.startRendering().then(onRecordingEnd).catch(handleError);
    inNode.start();

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
