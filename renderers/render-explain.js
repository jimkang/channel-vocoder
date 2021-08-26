import { select } from 'd3-selection';

var bodySel = select('body');

export function renderExplain({ explain }) {
  bodySel.classed('explain-root', explain);
  bodySel.classed('tool-root', !explain);
}
