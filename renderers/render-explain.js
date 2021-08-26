import { select, selectAll } from 'd3-selection';

var bodySel = select('body');

export function renderExplain({ explain }) {
  bodySel.classed('explain-root', explain);
  bodySel.classed('tool-root', !explain);

  if (explain) {
    selectAll('.step').classed('hidden', true);
  }
}
