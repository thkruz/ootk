import { Multi } from '@lib/ootk-multi.js';
import { Sgp4 } from '@lib/ootk-sgp4.js';

describe('test non webworker functions', () => {
  test('if chunkArray works', () => {
    expect(
      Multi.chunkArray(
        [
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
        ],
        2,
      ),
    ).toEqual([
      [
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
      ],
      [
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
      ],
    ]);
  });
  test('if chunkArray2 works', () => {
    expect(
      Multi.chunkArray2(
        [
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
          { satn: '00005' },
        ],
        2,
      ),
    ).toEqual([
      [
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
      ],
      [
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
        { satn: '00005' },
      ],
      [{ satn: '00005' }],
    ]);
  });
});

describe.skip('check that Pool class generates web workers', () => {
  test('if webworkers return message', () => {
    const multi = new Multi(8);
    let m = null;
    (async () => {
      let x = 0;
      let propTime = -1440;

      const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  00098-0 0  4753';
      const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
      const satrec = Sgp4.createSatrec(line1, line2, 'wgs72', 'i');

      const times = [];
      const satrecs = [];

      while (propTime <= 1440) {
        times.push(propTime);
        propTime += 20;
      }

      while (x < 1000) {
        satrecs.push(satrec);
        x++;
      }

      m = await multi.propagate(satrecs, times);
    })();

    expect(m).toEqual(1);
  });
});
