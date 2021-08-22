import { to } from 'await-to-js';

var envelopeFollowerModuleAdded = false;

export async function connectEnvelopeGet({
  inNode,
  ctx,
  smoothingFactorUp,
  smoothingFactorDown,
  onError,
}) {
  if (!envelopeFollowerModuleAdded) {
    let [efError] = await to(
      ctx.audioWorklet.addModule('modules/envelope-follower.js')
    );
    if (efError) {
      onError(efError);
      return;
    }

    envelopeFollowerModuleAdded = true;
  }

  var efNode = new AudioWorkletNode(ctx, 'envelope-follower-processor', {
    processorOptions: {
      smoothingFactorUp,
      smoothingFactorDown,
    },
  });
  inNode.connect(efNode);
  return efNode;
}
