export function connectBandpass({ ctx, Q, frequency, inNode }) {
  var bpNode = new BiquadFilterNode(ctx, {
    type: 'bandpass',
    Q,
    frequency,
  });

  inNode.connect(bpNode);
  return bpNode;
}
