import { select } from 'd3-selection';

var carrierLevelSel = select('#carrier-level');
var infoLevelSel = select('#info-level');
var smoothingUpSel = select('#smoothing-factor-up');
var smoothingDownSel = select('#smoothing-factor-down');
var qSel = select('#q-val');

export function renderParamControls({
  Q,
  smoothingFactorUp,
  smoothingFactorDown,
  carrierLevel,
  infoLevel,
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

  function UpdateState(key) {
    return function updateState() {
      routeState.addToRoute({ [key]: this.value });
    };
  }
}
