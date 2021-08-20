import { renderAudio } from 'render-audio';
import { select } from 'd3-selection';
import accessor from 'accessor';

export function renderBuffers({ labeledBuffers, containerSelector }) {
  var containerSel = select(containerSelector);
  var boxes = containerSel
    .selectAll('.labeled-audio')
    .data(labeledBuffers, accessor('label'));
  boxes.exit().remove();
  var newBoxes = boxes
    .enter()
    .append('div')
    .attr('class', classForLB)
    .classed('labeled-audio', true);
  newBoxes.append('h3').classed('label', true);
  newBoxes.append('div').classed('file-audio', true);

  var existingBoxes = newBoxes.merge(boxes);
  existingBoxes.select('.label').text(accessor('label'));
  existingBoxes.each((lb) =>
    renderAudio({
      audioBuffer: lb.buffer,
      containerSelector: `${containerSelector} .${classForLB(lb)}`,
    })
  );
}

function classForLB(lb) {
  return `labeled-audio-${lb.label.replace(/\./g, '_')}`;
}
