import { renderAudio } from 'render-audio';
import { select } from 'd3-selection';
import accessor from 'accessor';

export function renderBuffers({ labeledBuffers, containerSelector }) {
  labeledBuffers.sort(compareLabels);
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
      fitToParentWidth: true,
      //zoomable: true,
    })
  );
}

function classForLB(lb) {
  const labelString = '' + lb.label;
  return `labeled-audio-${labelString.replace(/\./g, '_')}`;
}

function compareLabels(a, b) {
  if (+a.label < +b.label) {
    return -1;
  }
  return 1;
}
