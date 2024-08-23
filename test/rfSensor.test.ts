import { CommLink, Degrees, Kilometers, Milliseconds, SpaceObjectType, ZoomValue } from '../src/main.js';
import { RfSensor } from '../src/objects/RfSensor.js';

describe('RfSensor', () => {
  it('should create a new RfSensor', () => {
    const sensor = new RfSensor({
      objName: 'RAFFYL',
      shortName: 'FYL',
      id: 0,
      name: 'RAF Fylingdales, United Kingdom',
      uiName: 'RAF Fylingdales',
      system: 'BMEWS UEWR',
      freqBand: 'UHF',
      type: SpaceObjectType.PHASED_ARRAY_RADAR,
      lat: <Degrees>54.361758,
      lon: <Degrees>-0.670051,
      alt: <Kilometers>0.26, // Open Street Maps
      minAz: <Degrees>0,
      maxAz: <Degrees>360,
      minEl: <Degrees>3,
      maxEl: <Degrees>85,
      minRng: <Kilometers>200,
      maxRng: <Kilometers>5556,
      changeObjectInterval: <Milliseconds>1000,
      beamwidth: <Degrees>2.0,
      commLinks: [CommLink.AEHF, CommLink.WGS],
      boresightAz: [<Degrees>0],
      boresightEl: [<Degrees>20],
      zoom: ZoomValue.LEO,
      country: 'United Kingdom',
      operator: 'Royal Air Force',
    });

    expect(sensor).toBeInstanceOf(RfSensor);
  });
});
