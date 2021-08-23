// Awkwardly different from the other
// audio-graph functions: Returns the
// source nodes.
export function connectBufferMergerToDest({ ctx, inBuffers }) {
  var srcNodes = inBuffers.map(
    (buffer) => new AudioBufferSourceNode(ctx, { buffer })
  );
  srcNodes.forEach((node) => node.connect(ctx.destination));
  return srcNodes;
}
