import { selectAll } from 'd3-selection';
//import accessor from 'accessor';
import { respondToFileChanges } from '../responders/respond-to-file-changes';

export function renderSources({ onBuffers }) {
  var inputSel = selectAll('.input-source');
  inputSel.on('change', onMediaChange);

  function onMediaChange() {
    var files = [];
    inputSel.each(getFile);
    respondToFileChanges({ files, onBuffers });

    function getFile() {
      if (this.files.length < 1) {
        return;
      }
      files.push(this.files[0]);
    }
  }
}
