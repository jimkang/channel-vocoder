import { select, selectAll } from 'd3-selection';

var nonstopButtonSel = select('#nonstop-button');
var stopModeButtonSel = select('#stop-mode-button');
var stopModeElementsSel = selectAll('.stop-mode');
var vocodeButtonSel = select('#vocode-button');

export function renderModeControl({ nonstop, onModeChange }) {
  renderDependents(nonstop);

  nonstopButtonSel.on('click', () => onChange(true));
  stopModeButtonSel.on('click', () => onChange(false));

  nonstopButtonSel.node().checked = nonstop;
  stopModeButtonSel.node().checked = !nonstop;

  function onChange(newNonstop) {
    renderDependents(newNonstop);
    onModeChange({ nonstop: newNonstop });
  }
}

function renderDependents(nonstop) {
  stopModeElementsSel.classed('hidden', nonstop);
  vocodeButtonSel.classed('hidden', !nonstop);
}
