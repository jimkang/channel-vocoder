import ContextKeeper from 'audio-context-singleton';

export function decodeArrayBuffer(arrayBuffer, done) {
  var contextKeeper = ContextKeeper();
  contextKeeper.getNewContext(useContext);

  function useContext(error, ctx) {
    if (error) {
      done(error);
      return;
    }

    ctx.decodeAudioData(arrayBuffer).then(passDecoded).catch(done);
  }

  function passDecoded(decodedAudioBuffer) {
    done(null, decodedAudioBuffer);
  }
}
