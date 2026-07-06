import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Vector3D } from '../../main';
import { AtmosphericDrag } from '../AtmosphericDrag';

describe('AtmosphericDrag', () => {
  // Low Earth orbit state where atmospheric drag is significant
  const epoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
  const altitude = 400; // km
  const position = new Vector3D<Kilometers>(
    (6378 + altitude) as Kilometers,
    0 as Kilometers,
    0 as Kilometers,
  );
  const velocity = new Vector3D<KilometersPerSecond>(
    0 as KilometersPerSecond,
    7.67 as KilometersPerSecond,
    0 as KilometersPerSecond,
  );
  const state = new J2000(epoch, position, velocity);

  // Typical spacecraft parameters
  const mass = 1000; // kg
  const area = 10; // m²
  const dragCoeff = 2.2;
  const cosine = 4;

  describe('constructor', () => {
    it('should create instance with default F10.7 value', () => {
      const drag = new AtmosphericDrag(mass, area, dragCoeff, cosine);

      expect(drag.mass).toBe(mass);
      expect(drag.area).toBe(area);
      expect(drag.dragCoeff).toBe(dragCoeff);
      expect(drag.cosine).toBe(cosine);
      expect(drag.f107).toBe(150); // default mean solar flux
    });

    it('should create instance with custom F10.7 value', () => {
      const f107 = 200;
      const drag = new AtmosphericDrag(mass, area, dragCoeff, cosine, f107);

      expect(drag.f107).toBe(f107);
    });

    it('should accept solar minimum F10.7 value', () => {
      const drag = new AtmosphericDrag(mass, area, dragCoeff, cosine, 70);

      expect(drag.f107).toBe(70);
    });

    it('should accept solar maximum F10.7 value', () => {
      const drag = new AtmosphericDrag(mass, area, dragCoeff, cosine, 250);

      expect(drag.f107).toBe(250);
    });
  });

  describe('acceleration', () => {
    it('should return Vector3D acceleration', () => {
      const drag = new AtmosphericDrag(mass, area, dragCoeff, cosine);
      const acc = drag.acceleration(state);

      expect(acc).toBeInstanceOf(Vector3D);
    });

    it('should produce higher drag at solar maximum than solar minimum', () => {
      const dragMin = new AtmosphericDrag(mass, area, dragCoeff, cosine, 70);
      const dragMax = new AtmosphericDrag(mass, area, dragCoeff, cosine, 250);

      const accMin = dragMin.acceleration(state);
      const accMax = dragMax.acceleration(state);

      // Higher F10.7 means denser atmosphere, so stronger drag deceleration
      expect(accMax.magnitude()).toBeGreaterThan(accMin.magnitude());
    });

    it('should produce intermediate drag at mean solar flux', () => {
      const dragMin = new AtmosphericDrag(mass, area, dragCoeff, cosine, 70);
      const dragMean = new AtmosphericDrag(mass, area, dragCoeff, cosine, 150);
      const dragMax = new AtmosphericDrag(mass, area, dragCoeff, cosine, 250);

      const accMin = dragMin.acceleration(state);
      const accMean = dragMean.acceleration(state);
      const accMax = dragMax.acceleration(state);

      const magMin = accMin.magnitude();
      const magMean = accMean.magnitude();
      const magMax = accMax.magnitude();

      expect(magMean).toBeGreaterThan(magMin);
      expect(magMean).toBeLessThan(magMax);
    });

    it('should clamp F10.7 values below minimum', () => {
      const dragBelow = new AtmosphericDrag(mass, area, dragCoeff, cosine, 50);
      const dragMin = new AtmosphericDrag(mass, area, dragCoeff, cosine, 70);

      const accBelow = dragBelow.acceleration(state);
      const accMin = dragMin.acceleration(state);

      // Values below 70 should be clamped, giving same result as 70
      expect(accBelow.magnitude()).toBeCloseTo(accMin.magnitude(), 10);
    });

    it('should clamp F10.7 values above maximum', () => {
      const dragAbove = new AtmosphericDrag(mass, area, dragCoeff, cosine, 300);
      const dragMax = new AtmosphericDrag(mass, area, dragCoeff, cosine, 250);

      const accAbove = dragAbove.acceleration(state);
      const accMax = dragMax.acceleration(state);

      // Values above 250 should be clamped, giving same result as 250
      expect(accAbove.magnitude()).toBeCloseTo(accMax.magnitude(), 10);
    });

    it('should return zero acceleration above atmosphere', () => {
      // GEO altitude - well above atmosphere
      const highPosition = new Vector3D<Kilometers>(
        42164 as Kilometers,
        0 as Kilometers,
        0 as Kilometers,
      );
      const highVelocity = new Vector3D<KilometersPerSecond>(
        0 as KilometersPerSecond,
        3.07 as KilometersPerSecond,
        0 as KilometersPerSecond,
      );
      const highState = new J2000(epoch, highPosition, highVelocity);

      const drag = new AtmosphericDrag(mass, area, dragCoeff, cosine);
      const acc = drag.acceleration(highState);

      expect(acc.magnitude()).toBe(0);
    });

    it('should produce drag opposing velocity direction', () => {
      const drag = new AtmosphericDrag(mass, area, dragCoeff, cosine, 200);
      const acc = drag.acceleration(state);

      /*
       * Drag should oppose velocity (negative y component for positive y velocity)
       * Note: The exact direction depends on Earth rotation effects
       */
      if (acc.magnitude() > 0) {
        // Drag acceleration should have a component opposing the velocity
        const velDotAcc = state.velocity.dot(acc);

        expect(velDotAcc).toBeLessThan(0);
      }
    });
  });

  describe('F10.7 scaling behavior', () => {
    it('should scale density proportionally with F10.7', () => {
      // Test that drag scales with F10.7 in expected range
      const f107Values = [70, 110, 150, 190, 230, 250];
      const accelerations = f107Values.map((f107) => {
        const drag = new AtmosphericDrag(mass, area, dragCoeff, cosine, f107);

        return drag.acceleration(state).magnitude();
      });

      // Each value should be greater than or equal to the previous
      for (let i = 1; i < accelerations.length; i++) {
        expect(accelerations[i]).toBeGreaterThanOrEqual(accelerations[i - 1]);
      }
    });
  });
});
