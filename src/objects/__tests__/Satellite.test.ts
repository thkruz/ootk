import { SensorType } from '../../enums/SensorType';
import { Satellite } from '../Satellite';
import { TleLine1, TleLine2, Degrees, Kilometers } from '../../types/types';
import { OpticalSensor } from '../../sensor/OpticalSensor';
import { Antenna } from '../../comm/Antenna';
import { Decibels, Hertz, Watts } from '../../comm/CommTypes';
import { Transmitter } from '../../comm/Transmitter';

describe('Satellite', () => {
  // ISS TLE for testing
  const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

  describe('history tracking', () => {
    it('should not have history enabled by default', () => {
      const sat = new Satellite({ tle1, tle2 });

      expect(sat.isHistoryEnabled).toBe(false);
      expect(sat.history).toBeNull();
    });

    it('should enable history via constructor config', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      expect(sat.isHistoryEnabled).toBe(true);
      expect(sat.history).not.toBeNull();
    });

    it('should record position after eci() when history enabled', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      const date1 = new Date('2022-07-22T11:16:14Z'); // Close to TLE epoch
      const date2 = new Date('2022-07-22T11:17:14Z'); // 1 minute later

      sat.eci(date1);
      sat.eci(date2);

      const history = sat.history!;

      expect(history.length).toBe(2);
      expect(history.getAll()[0].time).toEqual(date1);
      expect(history.getAll()[1].time).toEqual(date2);

      // Verify position data was recorded
      const entry = history.getAll()[0];

      expect(entry.data.position).toBeDefined();
      expect(entry.data.velocity).toBeDefined();
      expect(entry.data.position.x).not.toBe(0);
    });

    it('should respect sampling interval', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100, samplingInterval: 60000 }, // 60s minimum
      });

      const date1 = new Date('2022-07-22T11:16:14Z');
      const date2 = new Date('2022-07-22T11:16:44Z'); // 30s later (within interval)
      const date3 = new Date('2022-07-22T11:17:44Z'); // 90s after date1 (outside interval)

      sat.eci(date1);
      sat.eci(date2); // Should be skipped due to sampling interval
      sat.eci(date3);

      expect(sat.history!.length).toBe(2); // Only date1 and date3
    });

    it('should respect maxLength', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 3, autoClean: true },
      });

      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        const date = new Date('2022-07-22T11:16:14Z');

        date.setMinutes(date.getMinutes() + i);
        sat.eci(date);
      }

      // Should only keep the last 3
      expect(sat.history!.length).toBe(3);
    });

    it('should enable/disable history post-construction', () => {
      const sat = new Satellite({ tle1, tle2 });

      sat.enableHistory({ maxLength: 50 });
      expect(sat.isHistoryEnabled).toBe(true);

      sat.eci(new Date('2022-07-22T11:16:14Z'));
      expect(sat.history!.length).toBe(1);

      sat.disableHistory();
      expect(sat.history).toBeNull();
      expect(sat.isHistoryEnabled).toBe(false);
    });

    it('should not record when history disabled', () => {
      const sat = new Satellite({ tle1, tle2 });

      sat.eci(new Date('2022-07-22T11:16:14Z'));
      sat.eci(new Date('2022-07-22T11:17:14Z'));

      // History should still be null
      expect(sat.history).toBeNull();
    });

    it('should handle propagation failure without recording', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      // Try propagating to a date far in the future (will likely fail or be invalid)
      const farFuture = new Date('2100-01-01T00:00:00Z');
      const result = sat.eci(farFuture);

      // Even if it returns null or fails, history should not throw
      // and should not record invalid entries
      if (result === null) {
        expect(sat.history!.length).toBe(0);
      }
    });

    it('should preserve history data across multiple queries', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      const dates = [
        new Date('2022-07-22T11:16:14Z'),
        new Date('2022-07-22T11:17:14Z'),
        new Date('2022-07-22T11:18:14Z'),
      ];

      dates.forEach((date) => sat.eci(date));

      const history = sat.history!;
      const entries = history.getAll();

      expect(entries.length).toBe(3);

      // Verify each entry has correct structure
      entries.forEach((entry, i) => {
        expect(entry.time).toEqual(dates[i]);
        expect(entry.data.position).toBeDefined();
        expect(entry.data.velocity).toBeDefined();
        expect(typeof entry.data.position.x).toBe('number');
        expect(typeof entry.data.position.y).toBe('number');
        expect(typeof entry.data.position.z).toBe('number');
      });
    });

    it('should support getRange on history', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      const startDate = new Date('2022-07-22T11:16:14Z');

      // Add 5 entries, 1 minute apart
      for (let i = 0; i < 5; i++) {
        const date = new Date(startDate.getTime() + i * 60000);

        sat.eci(date);
      }

      // Get range for middle 3 entries
      const rangeStart = new Date(startDate.getTime() + 60000); // 2nd entry
      const rangeEnd = new Date(startDate.getTime() + 180000); // 4th entry

      const range = sat.history!.getRange(rangeStart, rangeEnd);

      expect(range.length).toBe(3);
    });

    it('should support getLast on history', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      const dates = [
        new Date('2022-07-22T11:16:14Z'),
        new Date('2022-07-22T11:17:14Z'),
        new Date('2022-07-22T11:18:14Z'),
      ];

      dates.forEach((date) => sat.eci(date));

      const last2 = sat.history!.getLast(2);

      expect(last2.length).toBe(2);
      expect(last2[0].time).toEqual(dates[1]);
      expect(last2[1].time).toEqual(dates[2]);
    });
  });

  describe('clone', () => {
    describe('satrec independence', () => {
      it('should create independent satrec objects', () => {
        const sat = new Satellite({ tle1, tle2 });
        const cloned = sat.clone();

        // Propagate original to a specific time
        const date1 = new Date('2022-07-22T11:16:14Z');
        const pos1 = sat.eci(date1);

        // Propagate clone to a different time
        const date2 = new Date('2022-07-22T23:00:00Z');

        cloned.eci(date2);

        // Propagate original again - should still work correctly
        const pos1Again = sat.eci(date1);

        expect(pos1?.position.x).toBeCloseTo(pos1Again?.position.x ?? NaN, 6);
        expect(pos1?.position.y).toBeCloseTo(pos1Again?.position.y ?? NaN, 6);
        expect(pos1?.position.z).toBeCloseTo(pos1Again?.position.z ?? NaN, 6);
      });

      it('should propagate independently without affecting original', () => {
        const sat = new Satellite({ tle1, tle2 });
        const cloned = sat.clone();

        // Both should have same TLE
        expect(cloned.tle1).toBe(sat.tle1);
        expect(cloned.tle2).toBe(sat.tle2);

        // But be independent objects
        expect(cloned).not.toBe(sat);
        expect(cloned.satrec).not.toBe(sat.satrec);
      });
    });

    describe('sensor cloning', () => {
      it('should deep clone sensors', () => {
        const sat = new Satellite({ tle1, tle2 });
        const sensor = new OpticalSensor({
          id: 7001,
          name: 'Test Optical Sensor',
          sensorType: SensorType.OPTICAL,
          fieldOfView: {
            boresightEl: 45 as Degrees,
            halfAngle: 30 as Degrees,
            minRange: 100 as Kilometers,
            maxRange: 50000 as Kilometers,
          },
          aperture: 0.5,
        });

        sat.addSensor(sensor);
        sensor.setParent(sat);

        const cloned = sat.clone();

        // Cloned satellite should have same number of sensors
        expect(cloned.sensors.length).toBe(1);

        // But they should be different instances
        expect(cloned.sensors[0]).not.toBe(sensor);
        expect(cloned.sensors[0].id).toBe(sensor.id);
        expect(cloned.sensors[0].name).toBe(sensor.name);
      });

      it('should update sensor parent to cloned satellite', () => {
        const sat = new Satellite({ tle1, tle2 });
        const sensor = new OpticalSensor({
          id: 7001,
          name: 'Test Optical Sensor',
          sensorType: SensorType.OPTICAL,
          fieldOfView: {
            boresightEl: 45 as Degrees,
            halfAngle: 30 as Degrees,
            minRange: 100 as Kilometers,
            maxRange: 50000 as Kilometers,
          },
        });

        sat.addSensor(sensor);
        sensor.setParent(sat);

        const cloned = sat.clone();
        const clonedSensor = cloned.sensors[0] as OpticalSensor;

        // Cloned sensor's parent should point to cloned satellite
        expect(clonedSensor.parent).toBe(cloned);
        expect(clonedSensor.parent).not.toBe(sat);

        // Original sensor's parent should still point to original satellite
        expect(sensor.parent).toBe(sat);
      });

      it('should not affect original sensors when modifying clone', () => {
        const sat = new Satellite({ tle1, tle2 });
        const sensor = new OpticalSensor({
          id: 7001,
          name: 'Test Optical Sensor',
          sensorType: SensorType.OPTICAL,
          fieldOfView: {
            boresightEl: 45 as Degrees,
            halfAngle: 30 as Degrees,
            minRange: 100 as Kilometers,
            maxRange: 50000 as Kilometers,
          },
        });

        sat.addSensor(sensor);
        sensor.setParent(sat);

        const cloned = sat.clone();
        const clonedSensor = cloned.sensors[0] as OpticalSensor;

        // Modify cloned sensor
        clonedSensor.name = 'Modified Sensor';

        // Original should be unchanged
        expect(sensor.name).toBe('Test Optical Sensor');
      });
    });

    describe('commDevice cloning', () => {
      it('should deep clone communication devices', () => {
        const sat = new Satellite({ tle1, tle2 });
        const transmitter = new Transmitter({
          id: 7002,
          name: 'Test Transmitter',
          frequency: 12e9 as Hertz,
          power: 50 as Watts,
          bandwidth: 36e6 as Hertz,
          antenna: new Antenna({ gain: 30 as Decibels }),
        });

        sat.addCommDevice(transmitter);
        transmitter.setParent(sat);

        const cloned = sat.clone();

        // Cloned satellite should have same number of comm devices
        expect(cloned.commDevices.length).toBe(1);

        // But they should be different instances
        expect(cloned.commDevices[0]).not.toBe(transmitter);
        expect(cloned.commDevices[0].id).toBe(transmitter.id);
        expect(cloned.commDevices[0].name).toBe(transmitter.name);
      });

      it('should update commDevice parent to cloned satellite', () => {
        const sat = new Satellite({ tle1, tle2 });
        const transmitter = new Transmitter({
          id: 7002,
          name: 'Test Transmitter',
          frequency: 12e9 as Hertz,
          power: 50 as Watts,
          bandwidth: 36e6 as Hertz,
          antenna: new Antenna({ gain: 30 as Decibels }),
        });

        sat.addCommDevice(transmitter);
        transmitter.setParent(sat);

        const cloned = sat.clone();
        const clonedTx = cloned.commDevices[0] as Transmitter;

        // Cloned comm device's parent should point to cloned satellite
        expect(clonedTx.parent).toBe(cloned);
        expect(clonedTx.parent).not.toBe(sat);

        // Original comm device's parent should still point to original satellite
        expect(transmitter.parent).toBe(sat);
      });
    });

    describe('history cloning', () => {
      it('should preserve history config but start empty by default', () => {
        const sat = new Satellite({
          tle1,
          tle2,
          historyConfig: { maxLength: 100, samplingInterval: 1000 },
        });

        sat.eci(new Date('2022-07-22T11:16:14Z'));
        sat.eci(new Date('2022-07-22T11:17:14Z'));

        const cloned = sat.clone();

        expect(cloned.isHistoryEnabled).toBe(true);
        expect(cloned.history?.config.maxLength).toBe(100);
        expect(cloned.history?.config.samplingInterval).toBe(1000);
        expect(cloned.history?.length).toBe(0); // Empty by default
      });

      it('should clone history entries when cloneHistory option is true', () => {
        const sat = new Satellite({
          tle1,
          tle2,
          historyConfig: { maxLength: 100 },
        });

        sat.eci(new Date('2022-07-22T11:16:14Z'));
        sat.eci(new Date('2022-07-22T11:17:14Z'));

        const cloned = sat.clone({ cloneHistory: true });

        expect(cloned.history?.length).toBe(sat.history?.length);
        expect(cloned.history?.length).toBe(2);
      });

      it('should have independent history after cloning with cloneHistory', () => {
        const sat = new Satellite({
          tle1,
          tle2,
          historyConfig: { maxLength: 100 },
        });

        sat.eci(new Date('2022-07-22T11:16:14Z'));

        const cloned = sat.clone({ cloneHistory: true });

        // Add more entries to clone
        cloned.eci(new Date('2022-07-22T11:17:14Z'));
        cloned.eci(new Date('2022-07-22T11:18:14Z'));

        // Original should not be affected
        expect(sat.history?.length).toBe(1);
        expect(cloned.history?.length).toBe(3);
      });

      it('should work without history enabled', () => {
        const sat = new Satellite({ tle1, tle2 });
        const cloned = sat.clone();

        expect(cloned.isHistoryEnabled).toBe(false);
        expect(cloned.history).toBeNull();
      });
    });

    describe('basic properties', () => {
      it('should clone id, name, and metadata', () => {
        const sat = new Satellite({
          tle1,
          tle2,
          name: 'Test Satellite',
        });

        sat.metadata = { customField: 'test value' };

        const cloned = sat.clone();

        expect(cloned.id).toBe(sat.id);
        expect(cloned.name).toBe(sat.name);
        expect(cloned.metadata).toEqual(sat.metadata);
        expect(cloned.metadata).not.toBe(sat.metadata); // Should be a copy
      });

      it('should preserve TLE-derived properties', () => {
        const sat = new Satellite({ tle1, tle2 });
        const cloned = sat.clone();

        expect(cloned.inclination).toBe(sat.inclination);
        expect(cloned.eccentricity).toBe(sat.eccentricity);
        expect(cloned.meanMotion).toBe(sat.meanMotion);
        expect(cloned.period).toBe(sat.period);
      });
    });
  });
});
