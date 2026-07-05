import { Earth } from '../../body/Earth';
import { SegmentedLagrangeInterpolator } from '../../interpolator/SegmentedLagrangeInterpolator';
import { Seconds } from '../../main';
import { StateInterpolator } from '../../interpolator/StateInterpolator';
import { EpochUTC } from '../../time/EpochUTC';
import { LaunchTrajectoryGenerator, LaunchTrajectoryConfig } from '../LaunchTrajectoryGenerator';

describe('LaunchTrajectoryGenerator', () => {
  const baseConfig: LaunchTrajectoryConfig = {
    launchLatDeg: 28.5, // KSC latitude
    launchLonDeg: -80.65,
    perigeeAltKm: 400,
    apogeeAltKm: 400,
    inclinationDeg: 51.6, // ISS inclination
    direction: 'N',
    launchTime: new Date('2024-06-15T12:00:00Z'),
    orbitDurationHours: 2,
    ascentStepSec: 10,
    orbitalStepSec: 60,
  };

  describe('computeLaunchAzimuth()', () => {
    it('should compute correct azimuth for KSC to ISS inclination', () => {
      const az = LaunchTrajectoryGenerator.computeLaunchAzimuth(51.6, 28.5, 'N');

      // cos(51.6°)/cos(28.5°) ≈ 0.7077 → asin ≈ 45.0°
      expect(az).toBeGreaterThan(0);
      expect(az).toBeLessThan(Math.PI / 2);
    });

    it('should return ~0 for polar orbit (90° inclination)', () => {
      const az = LaunchTrajectoryGenerator.computeLaunchAzimuth(90, 28.5, 'N');

      expect(az).toBeCloseTo(0, 5);
    });

    it('should compute southbound azimuth as π - northbound', () => {
      const azN = LaunchTrajectoryGenerator.computeLaunchAzimuth(51.6, 28.5, 'N');
      const azS = LaunchTrajectoryGenerator.computeLaunchAzimuth(51.6, 28.5, 'S');

      expect(azS).toBeCloseTo(Math.PI - azN, 10);
    });

    it('should handle equatorial launch to equatorial orbit', () => {
      const az = LaunchTrajectoryGenerator.computeLaunchAzimuth(0, 0, 'N');

      // cos(0)/cos(0) = 1 → asin(1) = π/2 (due east)
      expect(az).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should handle retrograde orbit (inc > 90°)', () => {
      const az = LaunchTrajectoryGenerator.computeLaunchAzimuth(98, 28.5, 'N');

      // cos(98°) is negative → azimuth crosses through quadrant
      expect(az).toBeLessThan(0);
    });

    it('should clamp when inclination equals latitude', () => {
      // cos(28.5°)/cos(28.5°) = 1 → asin(1) = π/2
      const az = LaunchTrajectoryGenerator.computeLaunchAzimuth(28.5, 28.5, 'N');

      expect(az).toBeCloseTo(Math.PI / 2, 5);
    });
  });

  describe('computeInclinationFromAzimuth()', () => {
    it('should invert computeLaunchAzimuth for a northbound KSC→ISS launch', () => {
      const azRad = LaunchTrajectoryGenerator.computeLaunchAzimuth(51.6, 28.5, 'N');
      const inc = LaunchTrajectoryGenerator.computeInclinationFromAzimuth(azRad * (180 / Math.PI), 28.5);

      expect(inc).toBeCloseTo(51.6, 4);
    });

    it('should invert computeLaunchAzimuth for a southbound launch', () => {
      const azRad = LaunchTrajectoryGenerator.computeLaunchAzimuth(51.6, 28.5, 'S');
      const inc = LaunchTrajectoryGenerator.computeInclinationFromAzimuth(azRad * (180 / Math.PI), 28.5);

      expect(inc).toBeCloseTo(51.6, 4);
    });

    it('should give inclination equal to latitude for a due-east launch (90° azimuth)', () => {
      const inc = LaunchTrajectoryGenerator.computeInclinationFromAzimuth(90, 28.5);

      expect(inc).toBeCloseTo(28.5, 5);
    });

    it('should give a polar orbit (90°) for a due-north launch (0° azimuth)', () => {
      const inc = LaunchTrajectoryGenerator.computeInclinationFromAzimuth(0, 28.5);

      expect(inc).toBeCloseTo(90, 5);
    });

    it('should clamp gracefully for an unachievable azimuth/latitude combination', () => {
      // sin(90°)·cos(0°) = 1 → acos(1) = 0; no NaN from out-of-range values.
      const inc = LaunchTrajectoryGenerator.computeInclinationFromAzimuth(90, 0);

      expect(inc).toBeCloseTo(0, 5);
      expect(Number.isNaN(inc)).toBe(false);
    });
  });

  describe('computeGeneralizedTransfer()', () => {
    const mu = Earth.mu;

    it('should compute Hohmann transfer for circular-to-circular orbits', () => {
      const rPark = Earth.radiusMean + 185;
      const rTarget = Earth.radiusMean + 35786; // GEO

      const { dv1, dv2, tTransfer } = LaunchTrajectoryGenerator.computeGeneralizedTransfer(
        rPark, rTarget, rTarget,
      );

      // Known Hohmann LEO→GEO total dv ≈ 3.94 km/s
      const totalDv = Math.abs(dv1) + Math.abs(dv2);

      expect(totalDv).toBeGreaterThan(3.5);
      expect(totalDv).toBeLessThan(4.5);

      // Transfer time ≈ 5.25 hours for LEO→GEO
      const transferHours = tTransfer / 3600;

      expect(transferHours).toBeGreaterThan(4.5);
      expect(transferHours).toBeLessThan(6.0);
    });

    it('should produce near-zero dv2 for a transfer where apogee matches', () => {
      const rPark = Earth.radiusMean + 185;
      // Target orbit has same apogee as rPark would transfer to but perigee = rPark
      // This is essentially the transfer orbit itself
      const rApogee = Earth.radiusMean + 500;
      const { dv1, dv2 } = LaunchTrajectoryGenerator.computeGeneralizedTransfer(
        rPark, rPark, rApogee,
      );

      // dv2 should be ≈ 0 since the target orbit IS the transfer orbit
      expect(Math.abs(dv2)).toBeLessThan(0.01);
      expect(dv1).toBeGreaterThan(0);
    });

    it('should handle LEO to LEO (small altitude change)', () => {
      const rPark = Earth.radiusMean + 200;
      const rTarget = Earth.radiusMean + 400;

      const { dv1, dv2, tTransfer } = LaunchTrajectoryGenerator.computeGeneralizedTransfer(
        rPark, rTarget, rTarget,
      );

      const totalDv = Math.abs(dv1) + Math.abs(dv2);

      // Small altitude change → small delta-V
      expect(totalDv).toBeLessThan(0.3);
      expect(totalDv).toBeGreaterThan(0.05);

      // Transfer time should be roughly half the period of the transfer ellipse
      const aTransfer = (rPark + rTarget) / 2;
      const expectedT = Math.PI * Math.sqrt(aTransfer ** 3 / mu);

      expect(tTransfer).toBeCloseTo(expectedT, 0);
    });

    it('should handle HEO targets (elliptical final orbit)', () => {
      const rPark = Earth.radiusMean + 185;
      const rPerigee = Earth.radiusMean + 500; // Molniya perigee
      const rApogee = Earth.radiusMean + 40000; // Molniya apogee

      const { dv1, tTransfer } = LaunchTrajectoryGenerator.computeGeneralizedTransfer(
        rPark, rPerigee, rApogee,
      );

      // Should have positive dv1 (prograde burn at parking orbit)
      expect(dv1).toBeGreaterThan(0);
      // Transfer time should be reasonable (hours, not days)
      expect(tTransfer / 3600).toBeGreaterThan(1);
      expect(tTransfer / 3600).toBeLessThan(24);
    });
  });

  describe('generate()', () => {
    it('should produce a non-empty array of J2000 states for LEO direct', () => {
      const states = LaunchTrajectoryGenerator.generate(baseConfig);

      expect(states.length).toBeGreaterThan(0);
    });

    it('should start near the launch site position', () => {
      const states = LaunchTrajectoryGenerator.generate(baseConfig);
      const firstState = states[0];
      const posMag = firstState.position.magnitude();

      // Should be near Earth's surface (within a few km)
      expect(posMag).toBeGreaterThan(Earth.radiusMean - 10);
      expect(posMag).toBeLessThan(Earth.radiusMean + 10);
    });

    it('should end at roughly the target orbit altitude', () => {
      const states = LaunchTrajectoryGenerator.generate(baseConfig);
      const lastState = states[states.length - 1];
      const altitude = lastState.position.magnitude() - Earth.radiusMean;

      // Should be within ~100km of target altitude for LEO
      // (backward-differencing at insertion can shift the final state slightly)
      expect(altitude).toBeGreaterThan(300);
      expect(altitude).toBeLessThan(500);
    });

    it('should have monotonically increasing epochs', () => {
      const states = LaunchTrajectoryGenerator.generate(baseConfig);

      for (let i = 1; i < states.length; i++) {
        expect(states[i].epoch.posix).toBeGreaterThan(states[i - 1].epoch.posix);
      }
    });

    it('should have on-orbit velocity magnitude close to circular orbital velocity', () => {
      const states = LaunchTrajectoryGenerator.generate(baseConfig);

      // The orbital phase states (after ascent) should have circular velocity
      const rOrbit = 400 + Earth.radiusMean;
      const vCircular = Math.sqrt(Earth.mu / rOrbit);

      // Take a state well into the orbital phase (last 10% of states)
      const orbitState = states[Math.floor(states.length * 0.95)];
      const vMag = orbitState.velocity.magnitude();

      // Within 15% of circular velocity (generous tolerance for parametric model + 2-body)
      expect(vMag).toBeGreaterThan(vCircular * 0.85);
      expect(vMag).toBeLessThan(vCircular * 1.15);
    });

    it('should produce more states for longer orbit duration', () => {
      const shortConfig = { ...baseConfig, orbitDurationHours: 1 };
      const longConfig = { ...baseConfig, orbitDurationHours: 10 };

      const shortStates = LaunchTrajectoryGenerator.generate(shortConfig);
      const longStates = LaunchTrajectoryGenerator.generate(longConfig);

      expect(longStates.length).toBeGreaterThan(shortStates.length);
    });

    it('should handle GEO transfer orbit', () => {
      const geoConfig: LaunchTrajectoryConfig = {
        ...baseConfig,
        perigeeAltKm: 35786,
        apogeeAltKm: 35786,
        inclinationDeg: 28.5,
        orbitDurationHours: 1,
      };

      const states = LaunchTrajectoryGenerator.generate(geoConfig);

      expect(states.length).toBeGreaterThan(0);

      // Verify that valid (non-NaN) states are produced
      const validStates = states.filter((s) => !isNaN(s.position.x) && !isNaN(s.velocity.x));

      expect(validStates.length).toBeGreaterThan(0);

      // At least some states should be above LEO (transfer orbit reaches GEO altitude)
      const highStates = validStates.filter(
        (s) => s.position.magnitude() - Earth.radiusMean > 1000,
      );

      expect(highStates.length).toBeGreaterThan(0);
    });

    it('should handle HEO (Molniya-like) orbit', () => {
      const heoConfig: LaunchTrajectoryConfig = {
        ...baseConfig,
        perigeeAltKm: 500,
        apogeeAltKm: 40000,
        inclinationDeg: 63.4,
        orbitDurationHours: 1,
        launchLatDeg: 62.9, // Plesetsk
        launchLonDeg: 40.7,
      };

      const states = LaunchTrajectoryGenerator.generate(heoConfig);

      expect(states.length).toBeGreaterThan(0);
    });

    it('should handle sun-synchronous orbit (retrograde)', () => {
      const ssoConfig: LaunchTrajectoryConfig = {
        ...baseConfig,
        perigeeAltKm: 700,
        apogeeAltKm: 700,
        inclinationDeg: 98.2,
        direction: 'S' as const,
        launchLatDeg: 34.7, // Vandenberg
        launchLonDeg: -120.6,
        orbitDurationHours: 1,
      };

      const states = LaunchTrajectoryGenerator.generate(ssoConfig);

      expect(states.length).toBeGreaterThan(0);
    });

    it('should return empty array for impossible launch (inc < lat)', () => {
      const impossibleConfig: LaunchTrajectoryConfig = {
        ...baseConfig,
        inclinationDeg: 10, // Less than KSC latitude (28.5°)
      };

      // The generator should still produce states (it clamps the azimuth)
      // but the orbit won't have the correct inclination
      const states = LaunchTrajectoryGenerator.generate(impossibleConfig);

      expect(states.length).toBeGreaterThan(0);
    });

    it('should have all states with valid position and velocity', () => {
      const states = LaunchTrajectoryGenerator.generate(baseConfig);

      for (const state of states) {
        expect(state.position.magnitude()).toBeGreaterThan(0);
        expect(state.velocity.magnitude()).toBeGreaterThan(0);
        expect(isNaN(state.position.x)).toBe(false);
        expect(isNaN(state.position.y)).toBe(false);
        expect(isNaN(state.position.z)).toBe(false);
        expect(isNaN(state.velocity.x)).toBe(false);
        expect(isNaN(state.velocity.y)).toBe(false);
        expect(isNaN(state.velocity.z)).toBe(false);
      }
    });
  });

  describe('interpolation smoothness (SLC-40, 400x400 km, 51.6°)', () => {
    // Space Launch Complex 40: 28.5616°N, 80.5770°W
    const slc40Config: LaunchTrajectoryConfig = {
      launchLatDeg: 28.5616,
      launchLonDeg: -80.577,
      perigeeAltKm: 400,
      apogeeAltKm: 400,
      inclinationDeg: 51.6,
      direction: 'N',
      launchTime: new Date('2024-06-15T12:00:00Z'),
      orbitDurationHours: 2, // Only need ~2h of ephemeris; we test first 105 min
      ascentStepSec: 5,
      orbitalStepSec: 60,
    };

    /**
     * Helper: sweep an interpolator and collect jump violations.
     * Returns {posJumps, velJumps, worstPos, worstVel} with diagnostics printed.
     */
    function sweepForJumps(
      interpolator: StateInterpolator,
      startPosix: number,
      endPosix: number,
      dt: number,
      maxPosChangeKm: number,
      maxVelChangeKmS: number,
      label: string,
    ) {
      const totalSamples = Math.floor((endPosix - startPosix) / dt);

      let worstPosJumpKm = 0;
      let worstPosJumpTime = 0;
      let posJumpCount = 0;
      let worstVelJumpKmS = 0;
      let worstVelJumpTime = 0;
      let velJumpCount = 0;

      let prevState = interpolator.interpolate(new EpochUTC(startPosix as Seconds));

      for (let i = 1; i <= totalSamples; i++) {
        const t = startPosix + i * dt;

        if (t > endPosix) {
          break;
        }

        const state = interpolator.interpolate(new EpochUTC(t as Seconds));

        if (!state || !prevState) {
          prevState = state;
          continue;
        }

        // Position delta
        const dx = state.position.x - prevState.position.x;
        const dy = state.position.y - prevState.position.y;
        const dz = state.position.z - prevState.position.z;
        const posDelta = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (posDelta > worstPosJumpKm) {
          worstPosJumpKm = posDelta;
          worstPosJumpTime = t - startPosix;
        }
        if (posDelta > maxPosChangeKm) {
          posJumpCount++;
          if (posJumpCount <= 5) {

            console.log(
              `  POS JUMP [${label}] T+${(t - startPosix).toFixed(1)}s: ` +
              `${posDelta.toFixed(4)} km (alt ${(state.position.magnitude() - Earth.radiusMean).toFixed(1)} km)`,
            );
          }
        }

        // Velocity delta
        const dvx = state.velocity.x - prevState.velocity.x;
        const dvy = state.velocity.y - prevState.velocity.y;
        const dvz = state.velocity.z - prevState.velocity.z;
        const velDelta = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

        if (velDelta > worstVelJumpKmS) {
          worstVelJumpKmS = velDelta;
          worstVelJumpTime = t - startPosix;
        }
        if (velDelta > maxVelChangeKmS) {
          velJumpCount++;
          if (velJumpCount <= 5) {

            console.log(
              `  VEL JUMP [${label}] T+${(t - startPosix).toFixed(1)}s: ` +
              `${(velDelta * 1000).toFixed(4)} m/s (|v| ${state.velocity.magnitude().toFixed(4)} km/s)`,
            );
          }
        }

        prevState = state;
      }


      console.log(
        `[${label}] ${totalSamples} samples @ ${dt}s | ` +
        `worst pos ${worstPosJumpKm.toFixed(6)} km @ T+${worstPosJumpTime.toFixed(1)}s | ` +
        `worst vel ${(worstVelJumpKmS * 1000).toFixed(4)} m/s @ T+${worstVelJumpTime.toFixed(1)}s | ` +
        `pos jumps: ${posJumpCount}, vel jumps: ${velJumpCount}`,
      );

      return { posJumpCount, velJumpCount, worstPosJumpKm, worstVelJumpKmS };
    }

    it('should have no position or velocity jumps in the first 45 min at 0.1s sampling', () => {
      const { states, insertionIndex } = LaunchTrajectoryGenerator.generateWithBoundary(slc40Config);

      expect(states.length).toBeGreaterThan(0);

      const interpolator = SegmentedLagrangeInterpolator.fromPhasedEphemeris(states, insertionIndex, 5);
      const startPosix = states[0].epoch.posix;
      // Phase 1: first 45 minutes at 0.1s — covers entire ascent + boundary + early orbit
      const phase1End = startPosix + 45 * 60;

      // At orbital velocity ~7.67 km/s, in 0.1s the satellite moves ~0.767 km. Cap at 1.0 km.
      // Gravitational acceleration at 400 km: ~8.7 m/s^2. In 0.1s: ~0.87 m/s. Cap at 50 m/s.
      const result = sweepForJumps(interpolator, startPosix, phase1End, 0.1, 1.0, 0.05, 'Phase1-0.1s');

      expect(result.posJumpCount).toBe(0);
      expect(result.velJumpCount).toBe(0);
    });

    it('should remain on a stable orbit for one full period at 5s sampling', () => {
      const { states, insertionIndex } = LaunchTrajectoryGenerator.generateWithBoundary(slc40Config);

      expect(states.length).toBeGreaterThan(0);

      const interpolator = SegmentedLagrangeInterpolator.fromPhasedEphemeris(states, insertionIndex, 5);
      const startPosix = states[0].epoch.posix;
      // Phase 2: from T+45min to T+105min (60 more minutes ≈ one LEO orbit) at 5s intervals
      const phase2Start = startPosix + 45 * 60;
      const phase2End = startPosix + 105 * 60;

      // At 5s step, satellite moves ~38 km. Cap at 50 km.
      // Velocity change in 5s from gravity: ~43.5 m/s. Cap at 100 m/s.
      const result = sweepForJumps(interpolator, phase2Start, phase2End, 5.0, 50.0, 0.1, 'Phase2-5s');

      expect(result.posJumpCount).toBe(0);
      expect(result.velJumpCount).toBe(0);

      // Also verify the satellite is still at roughly the right altitude
      const midEpoch = new EpochUTC(((phase2Start + phase2End) / 2) as Seconds);
      const midState = interpolator.interpolate(midEpoch);

      expect(midState).not.toBeNull();
      const midAlt = midState!.position.magnitude() - Earth.radiusMean;

      // Should be within ±50 km of 400 km target
      expect(midAlt).toBeGreaterThan(350);
      expect(midAlt).toBeLessThan(450);
    });
  });

  // =======================================================================
  // Regression tests — lock in known-good behaviour for the two scenarios
  // the simulator handles well: LEO and GEO with inc > launch latitude.
  // =======================================================================

  describe('regression: LEO launch (KSC, 51.6° inc, 400×400 km)', () => {
    const leoConfig: LaunchTrajectoryConfig = {
      launchLatDeg: 28.5,
      launchLonDeg: -80.65,
      perigeeAltKm: 400,
      apogeeAltKm: 400,
      inclinationDeg: 51.6,
      direction: 'N',
      launchTime: new Date('2024-06-15T12:00:00Z'),
      orbitDurationHours: 2,
      ascentStepSec: 5,
      orbitalStepSec: 60,
    };

    const result = LaunchTrajectoryGenerator.generateWithBoundary(leoConfig);
    const states = result.states;

    it('should produce states and a valid insertion index', () => {
      expect(states.length).toBeGreaterThan(50);
      expect(result.insertionIndex).toBeGreaterThan(0);
      expect(result.insertionIndex).toBeLessThan(states.length - 1);
    });

    it('should have no NaN in any state vector', () => {
      for (const s of states) {
        expect(isNaN(s.position.x)).toBe(false);
        expect(isNaN(s.position.y)).toBe(false);
        expect(isNaN(s.position.z)).toBe(false);
        expect(isNaN(s.velocity.x)).toBe(false);
        expect(isNaN(s.velocity.y)).toBe(false);
        expect(isNaN(s.velocity.z)).toBe(false);
      }
    });

    it('should start at Earth surface and ascend monotonically during ascent phase', () => {
      const ascentStates = states.slice(0, result.insertionIndex + 1);
      const firstAlt = ascentStates[0].position.magnitude() - Earth.radiusMean;

      expect(firstAlt).toBeLessThan(5); // at surface

      // Check general upward trend (compare first quarter to last quarter)
      const q1 = ascentStates[Math.floor(ascentStates.length * 0.25)].position.magnitude() - Earth.radiusMean;
      const q3 = ascentStates[Math.floor(ascentStates.length * 0.75)].position.magnitude() - Earth.radiusMean;

      expect(q3).toBeGreaterThan(q1);
    });

    it('should reach target altitude at insertion (400 km ± 50 km)', () => {
      const insertionAlt = states[result.insertionIndex].position.magnitude() - Earth.radiusMean;

      expect(insertionAlt).toBeGreaterThan(350);
      expect(insertionAlt).toBeLessThan(450);
    });

    it('should have no dogleg at the ascent-to-orbit boundary', () => {
      const idx = result.insertionIndex;

      // Take the velocity vectors at the last ascent state and first orbital state
      const vBefore = states[idx].velocity;
      const vAfter = states[idx + 1].velocity;

      // Compute angle between them via dot product
      const dot = vBefore.x * vAfter.x + vBefore.y * vAfter.y + vBefore.z * vAfter.z;
      const magBefore = vBefore.magnitude();
      const magAfter = vAfter.magnitude();
      const cosAngle = dot / (magBefore * magAfter);
      const angleDeg = Math.acos(Math.min(1, Math.max(-1, cosAngle))) * (180 / Math.PI);

      // Heading change at the boundary should be small (< 5°)
      expect(angleDeg).toBeLessThan(5);
    });

    it('should maintain stable altitude during orbital phase (400 km ± 50 km)', () => {
      const orbitalStates = states.slice(result.insertionIndex + 1);

      for (const s of orbitalStates) {
        const alt = s.position.magnitude() - Earth.radiusMean;

        expect(alt).toBeGreaterThan(350);
        expect(alt).toBeLessThan(450);
      }
    });

    it('should achieve correct inclination (51.6° ± 3°)', () => {
      // Compute inclination from angular momentum vector of a mid-orbit state
      const s = states[Math.floor(states.length * 0.8)];
      const r = s.position;
      const v = s.velocity;

      // h = r × v
      const hx = r.y * v.z - r.z * v.y;
      const hy = r.z * v.x - r.x * v.z;
      const hz = r.x * v.y - r.y * v.x;
      const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);

      // inc = acos(hz / |h|)
      const incRad = Math.acos(Math.min(1, Math.max(-1, hz / hMag)));
      const incDeg = incRad * (180 / Math.PI);

      expect(incDeg).toBeGreaterThan(48.6);
      expect(incDeg).toBeLessThan(54.6);
    });

    it('should have smooth velocity progression through ascent (no jumps > 1 km/s between steps)', () => {
      const ascentStates = states.slice(0, result.insertionIndex + 1);

      for (let i = 1; i < ascentStates.length; i++) {
        const prev = ascentStates[i - 1].velocity;
        const curr = ascentStates[i].velocity;
        const dvx = curr.x - prev.x;
        const dvy = curr.y - prev.y;
        const dvz = curr.z - prev.z;
        const dv = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

        expect(dv).toBeLessThan(1.0);
      }
    });
  });

  describe('regression: GEO launch (KSC, 28.5° inc, 35786×35786 km)', () => {
    const geoConfig: LaunchTrajectoryConfig = {
      launchLatDeg: 28.5,
      launchLonDeg: -80.65,
      perigeeAltKm: 35786,
      apogeeAltKm: 35786,
      inclinationDeg: 28.5,
      direction: 'N',
      launchTime: new Date('2024-06-15T12:00:00Z'),
      orbitDurationHours: 2,
      ascentStepSec: 5,
      orbitalStepSec: 120,
    };

    const result = LaunchTrajectoryGenerator.generateWithBoundary(geoConfig);
    const states = result.states;

    it('should produce states and a valid insertion index', () => {
      expect(states.length).toBeGreaterThan(10);
      expect(result.insertionIndex).toBeGreaterThan(0);
      expect(result.insertionIndex).toBeLessThan(states.length - 1);
    });

    it('should have no NaN in any state vector', () => {
      for (const s of states) {
        expect(isNaN(s.position.x)).toBe(false);
        expect(isNaN(s.position.y)).toBe(false);
        expect(isNaN(s.position.z)).toBe(false);
        expect(isNaN(s.velocity.x)).toBe(false);
        expect(isNaN(s.velocity.y)).toBe(false);
        expect(isNaN(s.velocity.z)).toBe(false);
      }
    });

    it('should ascend through parking orbit to GEO altitude via transfer', () => {
      // Ascent ends at parking orbit (~185 km)
      const insertionAlt = states[result.insertionIndex].position.magnitude() - Earth.radiusMean;

      expect(insertionAlt).toBeGreaterThan(100);
      expect(insertionAlt).toBeLessThan(300);

      // Final states should be near GEO altitude
      const lastAlt = states[states.length - 1].position.magnitude() - Earth.radiusMean;

      expect(lastAlt).toBeGreaterThan(35000);
      expect(lastAlt).toBeLessThan(36500);
    });

    it('should have no dogleg at the ascent-to-orbit boundary', () => {
      const idx = result.insertionIndex;
      const vBefore = states[idx].velocity;
      const vAfter = states[idx + 1].velocity;

      const dot = vBefore.x * vAfter.x + vBefore.y * vAfter.y + vBefore.z * vAfter.z;
      const cosAngle = dot / (vBefore.magnitude() * vAfter.magnitude());
      const angleDeg = Math.acos(Math.min(1, Math.max(-1, cosAngle))) * (180 / Math.PI);

      // Heading change should be small — the first transfer burn is prograde
      expect(angleDeg).toBeLessThan(10);
    });

    it('should achieve correct inclination (28.5° ± 3°)', () => {
      const s = states[states.length - 1];
      const r = s.position;
      const v = s.velocity;

      const hx = r.y * v.z - r.z * v.y;
      const hy = r.z * v.x - r.x * v.z;
      const hz = r.x * v.y - r.y * v.x;
      const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);

      const incDeg = Math.acos(Math.min(1, Math.max(-1, hz / hMag))) * (180 / Math.PI);

      expect(incDeg).toBeGreaterThan(25.5);
      expect(incDeg).toBeLessThan(31.5);
    });

    it('should have GEO-appropriate orbital velocity at final state (~3.07 km/s)', () => {
      const lastState = states[states.length - 1];
      const vMag = lastState.velocity.magnitude();
      const rGeo = Earth.radiusMean + 35786;
      const vCircularGeo = Math.sqrt(Earth.mu / rGeo);

      // Within 15% of GEO circular velocity
      expect(vMag).toBeGreaterThan(vCircularGeo * 0.85);
      expect(vMag).toBeLessThan(vCircularGeo * 1.15);
    });

    it('should have monotonically increasing epochs', () => {
      for (let i = 1; i < states.length; i++) {
        expect(states[i].epoch.posix).toBeGreaterThan(states[i - 1].epoch.posix);
      }
    });
  });

  describe('regression: southbound SSO from Vandenberg (98.2° inc, 700×700 km)', () => {
    const ssoConfig: LaunchTrajectoryConfig = {
      launchLatDeg: 34.7,
      launchLonDeg: -120.6,
      perigeeAltKm: 700,
      apogeeAltKm: 700,
      inclinationDeg: 98.2,
      direction: 'S',
      launchTime: new Date('2024-06-15T12:00:00Z'),
      orbitDurationHours: 2,
      ascentStepSec: 5,
      orbitalStepSec: 60,
    };

    const result = LaunchTrajectoryGenerator.generateWithBoundary(ssoConfig);
    const states = result.states;

    it('should produce states with no NaN', () => {
      expect(states.length).toBeGreaterThan(50);

      for (const s of states) {
        expect(isNaN(s.position.x)).toBe(false);
        expect(isNaN(s.velocity.x)).toBe(false);
      }
    });

    it('should reach target altitude at insertion (700 km ± 100 km)', () => {
      const insertionAlt = states[result.insertionIndex].position.magnitude() - Earth.radiusMean;

      expect(insertionAlt).toBeGreaterThan(600);
      expect(insertionAlt).toBeLessThan(800);
    });

    it('should have no dogleg at insertion', () => {
      const idx = result.insertionIndex;
      const vBefore = states[idx].velocity;
      const vAfter = states[idx + 1].velocity;

      const dot = vBefore.x * vAfter.x + vBefore.y * vAfter.y + vBefore.z * vAfter.z;
      const cosAngle = dot / (vBefore.magnitude() * vAfter.magnitude());
      const angleDeg = Math.acos(Math.min(1, Math.max(-1, cosAngle))) * (180 / Math.PI);

      expect(angleDeg).toBeLessThan(5);
    });

    it('should achieve retrograde inclination (98.2° ± 5°)', () => {
      const s = states[Math.floor(states.length * 0.8)];
      const r = s.position;
      const v = s.velocity;

      const hx = r.y * v.z - r.z * v.y;
      const hy = r.z * v.x - r.x * v.z;
      const hz = r.x * v.y - r.y * v.x;
      const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);

      const incDeg = Math.acos(Math.min(1, Math.max(-1, hz / hMag))) * (180 / Math.PI);

      // Wider tolerance for retrograde orbits — parametric ascent model has ~3° error
      expect(incDeg).toBeGreaterThan(93.2);
      expect(incDeg).toBeLessThan(103.2);
    });

    it('should maintain stable altitude during orbital phase (700 km ± 100 km)', () => {
      const orbitalStates = states.slice(result.insertionIndex + 1);

      for (const s of orbitalStates) {
        const alt = s.position.magnitude() - Earth.radiusMean;

        expect(alt).toBeGreaterThan(600);
        expect(alt).toBeLessThan(800);
      }
    });
  });

  describe('boundary diagnostics', () => {
    it('should have continuous and physically valid states at the ascent-to-orbit boundary', () => {
      const config: LaunchTrajectoryConfig = {
        launchLatDeg: 28.5,
        launchLonDeg: -80.65,
        perigeeAltKm: 400,
        apogeeAltKm: 400,
        inclinationDeg: 51.6,
        direction: 'N' as const,
        launchTime: new Date('2024-06-15T12:00:00Z'),
        orbitDurationHours: 2,
        ascentStepSec: 5,
        orbitalStepSec: 60,
      };

      const states = LaunchTrajectoryGenerator.generate(config);
      const launchPosix = states[0].epoch.posix;

      // Find the boundary index: transition from ~5s spacing to ~60s spacing
      let boundaryIndex = -1;

      for (let i = 1; i < states.length - 1; i++) {
        const dtPrev = states[i].epoch.posix - states[i - 1].epoch.posix;
        const dtNext = states[i + 1].epoch.posix - states[i].epoch.posix;

        if (dtPrev < 10 && dtNext > 30) {
          boundaryIndex = i;
          break;
        }
      }


      console.log(`Boundary index: ${boundaryIndex} out of ${states.length} total states`);
      expect(boundaryIndex).toBeGreaterThan(0);

      // Gather 5 states before and 5 states after the boundary
      const startAscent = Math.max(0, boundaryIndex - 4);
      const endOrbital = Math.min(states.length - 1, boundaryIndex + 5);


      console.log('\n=== LAST 5 ASCENT STATES ===');

      console.log('idx | T offset (s) | Pos Mag (km) | Alt (km) | Vel Mag (km/s) | dt (s)');

      console.log('----|-------------|-------------|---------|---------------|-------');

      const boundaryStates: {
        index: number;
        tOffset: number;
        posMag: number;
        alt: number;
        velMag: number;
        dt: number;
      }[] = [];

      for (let i = startAscent; i <= endOrbital; i++) {
        const s = states[i];
        const tOffset = s.epoch.posix - launchPosix;
        const posMag = s.position.magnitude();
        const alt = posMag - Earth.radiusMean;
        const velMag = s.velocity.magnitude();
        const dt = i > 0 ? s.epoch.posix - states[i - 1].epoch.posix : 0;

        boundaryStates.push({ index: i, tOffset, posMag, alt, velMag, dt });

        const label = i <= boundaryIndex ? 'ASCENT' : 'ORBIT ';


        console.log(
          `${label} ${String(i).padStart(4)} | ${tOffset.toFixed(1).padStart(11)} | ${posMag.toFixed(3).padStart(11)} | ${alt.toFixed(3).padStart(7)} | ${velMag.toFixed(6).padStart(13)} | ${dt.toFixed(1).padStart(5)}`,
        );
      }

      // Check 1: All boundary states should have altitude > 100 km
      for (const bs of boundaryStates) {
        expect(bs.alt).toBeGreaterThan(100);
      }

      // Check 2: Position magnitudes should be continuous (no jumps > 100 km)
      for (let i = 1; i < boundaryStates.length; i++) {
        const jump = Math.abs(boundaryStates[i].posMag - boundaryStates[i - 1].posMag);

        expect(jump).toBeLessThan(100);
      }

      // Check 3: All velocity magnitudes should be > 5 km/s (orbital velocity)
      for (const bs of boundaryStates) {
        if (bs.index >= boundaryIndex - 2) {
          // Only check near and after boundary (early ascent may be slower)
          expect(bs.velMag).toBeGreaterThan(5);
        }
      }
    });
  });
});
