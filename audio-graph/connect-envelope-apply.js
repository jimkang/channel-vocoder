export function connectEnvelopeApply({
  inCarrierNode,
  inEnvelopeNode,
  ctx,
  carrierLevel,
  envLevel,
}) {
  var mNode = new GainNode(ctx);
  var carrierAmpNode = new GainNode(ctx);
  carrierAmpNode.gain.value = carrierLevel;
  var infoAmpNode = new GainNode(ctx);
  // Why??
  infoAmpNode.gain.value = -1.0 * envLevel;

  inCarrierNode.connect(carrierAmpNode);
  carrierAmpNode.connect(mNode);
  inEnvelopeNode.connect(infoAmpNode);
  infoAmpNode.connect(mNode.gain);

  return mNode;
}
