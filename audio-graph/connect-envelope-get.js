import { to } from 'await-to-js';

export async function connectEnvelopeGet({
  inNode,
  ctx,
  smoothingFactorUp,
  smoothingFactorDown,
  onError,
}) {
  let [efError] = await to(
    ctx.audioWorklet.addModule('modules/envelope-follower.js')
  );
  if (efError) {
    onError(efError);
    return;
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
