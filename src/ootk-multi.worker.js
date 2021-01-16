// eslint-disable-next-line no-undef
importScripts('./ootk-sgp4.js');
const decoderInst = new TextDecoder();

onmessage = function (m) {
  const data = JSON.parse(decoderInst.decode(m.data));
  switch (data.type) {
    case 'propagate':
      propagate(data);
      break;

    default:
      throw new Error('Invalid type');
  }
};

var propagate = (data) => {
  const satrecs = data.tasks;
  const times = data.times;
  let allResults = [];

  for (let i = 0; i < satrecs.length; i++) {
    for (let j = 0; j < times.length; j++) {
      // eslint-disable-next-line no-undef
      const stateVector = Ootk.Sgp4.propagate(satrecs[i], times[j]);
      allResults.push(
        times[j],
        stateVector.position.x,
        stateVector.position.y,
        stateVector.position.z,
        stateVector.velocity.x,
        stateVector.velocity.y,
        stateVector.velocity.z,
      );
    }
  }

  const resultBuffer = new Float32Array(allResults).buffer;
  postMessage(resultBuffer, [resultBuffer]);
};
