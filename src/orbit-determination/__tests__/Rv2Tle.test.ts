import { Tle } from '../../coordinate/Tle';
import { Sgp4 } from '../../main';
import { rv2tle, RvVector } from '../Rv2Tle';

/**
 * The maneuver workflow depends on the analyst satellite occupying the same
 * position as the original satellite at the burn time, so these tests measure
 * exactly that: take a real TLE's propagated state, fit a new TLE from it
 * (optionally with a delta-V applied), and compare positions.
 */
describe('rv2tle', () => {
  // ISS-class orbit (same fixture used by the conjunction tests)
  const tleLine1 = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005';
  const tleLine2 = '2 25544  51.6400 208.9163 0006317  69.9862 290.2553 15.54225995 12345';

  const distKm = (a: RvVector, b: RvVector): number => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

  /** Propagates the reference TLE to epoch + minutes, returning time + TEME state. */
  const stateAt = (minutes: number): { time: Date; position: RvVector; velocity: RvVector } => {
    const tle = new Tle(tleLine1, tleLine2);
    const satrec = Sgp4.createSatrec(tleLine1, tleLine2);
    const sv = Sgp4.propagate(satrec, minutes);

    return {
      time: new Date(tle.epoch.toDateTime().getTime() + minutes * 60_000),
      position: sv.position as RvVector,
      velocity: sv.velocity as RvVector,
    };
  };

  /**
   * Propagates the fitted TLE to `time` exactly the way the renderer does:
   * tsince computed from the epoch WRITTEN IN THE TLE. This catches epoch
   * quantization bugs (a truncated epoch shows up as pure in-track error).
   */
  const propagateFitted = (result: { tle1: string; tle2: string }, time: Date): { position: RvVector; velocity: RvVector } => {
    const fittedTle = new Tle(result.tle1 as never, result.tle2 as never);
    const satrec = Sgp4.createSatrec(result.tle1, result.tle2);
    const sv = Sgp4.propagate(satrec, (time.getTime() - fittedTle.epoch.toDateTime().getTime()) / 60_000);

    return { position: sv.position as RvVector, velocity: sv.velocity as RvVector };
  };

  /*
   * Burn time with NON-ZERO seconds (epoch + 90 min 38 s): a TLE epoch
   * truncated to the whole minute turns those 38 seconds into ~290 km of pure
   * in-track error, which is exactly the regression this guards against.
   */
  const BURN_MINUTES = 90 + 38 / 60;

  it('reproduces the original satellite position at the fit epoch (zero delta-V)', () => {
    const { time, position, velocity } = stateAt(BURN_MINUTES);
    const result = rv2tle(time, position, velocity);

    expect(result).not.toBeNull();
    // The analyst satellite must sit on top of the original at the burn time
    expect(result!.positionErrorKm).toBeLessThan(0.01);

    const fitted = propagateFitted(result!, time);

    expect(distKm(fitted.position, position)).toBeLessThan(0.01);
    expect(distKm(fitted.velocity as RvVector, velocity)).toBeLessThan(0.005);
  });

  it('stays close to the original over the following orbit (zero delta-V)', () => {
    const { time, position, velocity } = stateAt(BURN_MINUTES);
    const result = rv2tle(time, position, velocity)!;

    const later = stateAt(BURN_MINUTES + 45);
    const fittedLater = propagateFitted(result, later.time);

    // No bstar in the fitted TLE, so allow a small drag divergence
    expect(distKm(fittedLater.position, later.position)).toBeLessThan(2);
  });

  it('matches the post-burn state at the burn time for a 1000 m/s radial burn', () => {
    const { time, position, velocity } = stateAt(BURN_MINUTES);

    // Radial unit vector and a 1 km/s radial delta-V
    const r = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
    const postBurnVelocity = {
      x: velocity.x + position.x / r,
      y: velocity.y + position.y / r,
      z: velocity.z + position.z / r,
    };

    const result = rv2tle(time, position, postBurnVelocity);

    expect(result).not.toBeNull();
    expect(result!.positionErrorKm).toBeLessThan(0.01);

    const fitted = propagateFitted(result!, time);

    // Same position as the original at the burn instant...
    expect(distKm(fitted.position, position)).toBeLessThan(0.01);
    // ...but on the new orbit (velocity reflects the burn)
    expect(distKm(fitted.velocity as RvVector, postBurnVelocity)).toBeLessThan(0.005);
  });

  it('returns null for a state vector that SGP4 cannot represent', () => {
    // Position inside the Earth
    expect(rv2tle(new Date(Date.UTC(2025, 0, 19)), { x: 100, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
  });
});
