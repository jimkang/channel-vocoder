import { select } from 'd3-selection';

var carrierLevelSel = select('#carrier-level');
var infoLevelSel = select('#info-level');
var smoothingUpSel = select('#smoothing-factor-up');
var smoothingDownSel = select('#smoothing-factor-down');
var qSel = select('#q-val');
var carrierFileSel = select('#carrier-file');
var infoFileSel = select('#info-file');

export function renderParamControls({
  Q,
  smoothingFactorUp,
  smoothingFactorDown,
  carrierLevel,
  infoLevel,
  disable,
  routeState,
}) {
  qSel.on('blur', UpdateState('Q'));
  smoothingUpSel.on('blur', UpdateState('smoothingFactorUp'));
  smoothingDownSel.on('blur', UpdateState('smoothingFactorDown'));
  carrierLevelSel.on('blur', UpdateState('carrierLevel'));
  infoLevelSel.on('blur', UpdateState('infoLevel'));

  qSel.node().value = Q;
  smoothingUpSel.node().value = smoothingFactorUp;
  smoothingDownSel.node().value = smoothingFactorDown;
  carrierLevelSel.node().value = carrierLevel;
  infoLevelSel.node().value = infoLevel;

  qSel.attr('disabled', disable ? '' : null);
  smoothingUpSel.attr('disabled', disable ? '' : null);
  smoothingDownSel.attr('disabled', disable ? '' : null);
  carrierLevelSel.attr('disabled', disable ? '' : null);
  infoLevelSel.attr('disabled', disable ? '' : null);

  carrierFileSel.classed('hidden', disable);
  infoFileSel.classed('hidden', disable);

  function UpdateState(key) {
    return function updateState() {
      routeState.addToRoute({ [key]: this.value }, false);
    };
  }
}
