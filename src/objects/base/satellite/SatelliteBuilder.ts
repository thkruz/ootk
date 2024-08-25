import { LaunchInfo, OperationalInfo, SatelliteAdv, SpacecraftDetails, TleLine1, TleLine2 } from '../../../main.js';

export class SatelliteBuilder {
  private satellite: SatelliteAdv;

  constructor(params: { tle1: TleLine1; tle2: TleLine2 }) {
    this.satellite = new SatelliteAdv({
      tle1: params.tle1,
      tle2: params.tle2,
    });
  }

  withId(id: number): this {
    this.satellite.id = id;

    return this;
  }

  withName(name: string): this {
    this.satellite.core.name = name;

    return this;
  }

  withTLE(tle1: TleLine1, tle2: TleLine2): this {
    this.satellite.orbitData.editTle(tle1, tle2);

    return this;
  }

  withLaunchInfo(launchInfo: LaunchInfo): this {
    this.satellite.launchInfo = launchInfo;

    return this;
  }

  withSpacecraftDetails(details: SpacecraftDetails): this {
    this.satellite.spaceCraftDetails = details;

    return this;
  }

  withOperationalInfo(info: OperationalInfo): this {
    this.satellite.operationalInfo = info;

    return this;
  }

  build(): SatelliteAdv {
    // Perform validation
    if (!this.satellite.orbitData.tle1 || !this.satellite.orbitData.tle2) {
      throw new Error('TLE must be set');
    }

    return this.satellite;
  }
}
