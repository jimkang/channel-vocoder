class MultiplierProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputList, outputList) {
    /* using the inputs (or not, as needed), write the output
       into each of the outputs */
    if (inputList.length < 2 && outputList.length < 1) {
      return false;
    }

    const inputBase = inputList[0];
    const inputModulator = inputList[1];
    const output = outputList[0];

    let channelCount = Math.min(inputBase.length, output.length);

    for (let channelNum = 0; channelNum < channelCount; channelNum++) {
      let samplesBase = inputBase[channelNum];
      let samplesModulator = inputModulator[channelNum];
      const sampleCount = samplesBase.length;
      for (let i = 0; i < sampleCount; i++) {
        const sampleBase = samplesBase[i];
        const sampleModulator = samplesModulator[i];
        output[channelNum][i] = sampleBase * sampleModulator;
      }
    }

    return true;
  }
}

registerProcessor('multiplier-processor', MultiplierProcessor);
