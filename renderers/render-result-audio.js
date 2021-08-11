import { select } from 'd3-selection';
import toWav from 'audiobuffer-to-wav';

export function renderResultAudio({ audioBuffer, containerSelector }) {
  var blob = new Blob([toWav(audioBuffer)]);
  var objectURL = URL.createObjectURL(blob);

  var containerSel = select(containerSelector).classed('hidden', false);
  containerSel.select('audio').attr('src', objectURL);
}
