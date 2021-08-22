class EnvelopeFollowerProcessor extends AudioWorkletProcessor {
  constructor({ processorOptions }) {
    super();
    this.smoothingFactorUp = processorOptions.smoothingFactorUp;
    this.smoothingFactorDown = processorOptions.smoothingFactorDown;
    this.prevAvg;
    //this.lowest = 0;
  }

  process(inputList, outputList) {
    /* using the inputs (or not, as needed), write the output
       into each of the outputs */
    if (inputList.length < 1 && outputList.length < 1) {
      return false;
    }

    const input = inputList[0];
    const output = outputList[0];

    let channelCount = Math.min(input.length, output.length);

    for (let channelNum = 0; channelNum < channelCount; channelNum++) {
      let samples = input[channelNum];
      const sampleCount = samples.length;
      for (let i = 0; i < sampleCount; i++) {
        const sample = samples[i];
        // This is the rectifying.
        const squared = sample * sample;
        if (this.prevAvg === undefined) {
          this.prevAvg = squared;
          continue;
        }
        let smoothingFactor = this.smoothingFactorDown;
        if (squared > this.prevAvg) {
          smoothingFactor = this.smoothingFactorUp;
        }
        const avg = calcNextAvg(this.prevAvg, smoothingFactor, squared);
        output[channelNum][i] = avg;
        this.prevAvg = avg;
        //if (avg < this.lowest) {
        //this.lowest = avg;
        //}
      }
    }

    //console.log('lowest from worklet', this.lowest);
    return true;
  }
}

function calcNextAvg(prevAvg, smoothingFactor, currentValue) {
  const inverseSmoothingFactor = 1.0 - smoothingFactor;
  return smoothingFactor * prevAvg + inverseSmoothingFactor * currentValue;
}

registerProcessor('envelope-follower-processor', EnvelopeFollowerProcessor);
