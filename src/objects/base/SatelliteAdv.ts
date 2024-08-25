import {
  Geodetic,
  ITRF,
  J2000,
  RIC, ClassicalElements, RAE,
  Vector3D, EpochUTC,
  ecf2rae,
  eci2ecf,
  eci2lla, Degrees,
  EcfVec3,
  EciVec3,
  Kilometers,
  KilometersPerSecond, PosVel,
  Radians, Seconds,
  TleLine1,
  TleLine2,
  DEG2RAD, RAD2DEG,
  dopplerFactor,
  BaseObjectAdv,
  GroundObject,
  SpaceObjectType,
  OperationalInfo,
  SpacecraftDetails,
  LaunchInfo,
  OrbitData,
  SatelliteCore,
  LlaVec3,
  RaeVec3,
  Tle,
  BaseObjectParams,
  Serializer,
} from '../../main.js';

export interface SatelliteObserver {
  update(parent: BaseObjectAdv): void;
}

export interface SatelliteParams extends BaseObjectParams {
  id?: number;
  name?: string;
  type?: SpaceObjectType;
  rcs?: number | null;
  tle1: TleLine1;
  tle2: TleLine2;
  vmag?: number | null;
  sccNum?: string;
  intlDes?: string;
  position?: EciVec3;
  time?: Date;
  active?: boolean;
  configuration?: string;
  country?: string;
  dryMass?: string;
  equipment?: string;
  launchDate?: string;
  launchMass?: string;
  launchSite?: string;
  launchVehicle?: string;
  lifetime?: string | number;
  maneuver?: string;
  manufacturer?: string;
  mission?: string;
  motor?: string;
  owner?: string;
  bus?: string;
  payload?: string;
  power?: string;
  purpose?: string;
  length?: string;
  diameter?: string;
  shape?: string;
  span?: string;
  user?: string;
  source?: string;
  altId?: string;
  altName?: string;
}

export class SatelliteAdv extends BaseObjectAdv {
  core: SatelliteCore;
  launchInfo: LaunchInfo;
  spaceCraftDetails: SpacecraftDetails;
  operationalInfo: OperationalInfo;
  orbitData: OrbitData;

  constructor(info: SatelliteParams) {
    super(info);

    if (info.id) {
      this.id = info.id;
    }

    this.core = new SatelliteCore({
      name: info.name ?? '',
      altId: info.altId ?? '',
      altName: info.altName ?? '',
      sccNum: Tle.rawSatNum(info.tle1),
      intlDes: info.intlDes ?? '',
      tle1: info.tle1,
      tle2: info.tle2,
    });
    this.orbitData = new OrbitData({
      sat: this.core,
      tle1: info.tle1,
      tle2: info.tle2,
    });
    this.launchInfo = new LaunchInfo({
      launchDate: info.launchDate,
      launchMass: info.launchMass,
      launchSite: info.launchSite,
      launchVehicle: info.launchVehicle,
    });
    this.spaceCraftDetails = new SpacecraftDetails({
      lifetime: info.lifetime,
      maneuver: info.maneuver,
      manufacturer: info.manufacturer,
      motor: info.motor,
      power: info.power,
      payload: info.payload,
      purpose: info.purpose,
      shape: info.shape,
      span: info.span,
      bus: info.bus,
      configuration: info.configuration,
      equipment: info.equipment,
      dryMass: info.dryMass,
      length: info.length,
      diameter: info.diameter,
      rcs: info.rcs,
      vmag: info.vmag,
    });
    this.operationalInfo = new OperationalInfo({
      user: info.user,
      mission: info.mission,
      owner: info.owner,
      country: info.country,
    });
  }

  private notifyObservers(): void {
    for (const attachedObject of this.attachedObjects) {
      if ('update' in attachedObject) {
        (attachedObject as SatelliteObserver).update(this);
      }
    }
  }

  az(observer: BaseObjectAdv, date: Date = new Date()): Degrees {
    return (this.rae(observer, date).az * RAD2DEG) as Degrees;
  }

  toRae(observer: BaseObjectAdv, date: Date = new Date()): RAE {
    const rae = this.rae(observer, date);
    const rae2 = this.rae(observer, new Date(date.getTime() + 1000));
    const epoch = new EpochUTC(date.getTime() / 1000 as Seconds);
    const rangeRate = rae2.rng - rae.rng;
    const azimuthRate = rae2.az - rae.az;
    const elevationRate = rae2.el - rae.el;

    return new RAE(
      epoch,
      rae.rng,
      (rae.az * DEG2RAD) as Radians,
      (rae.el * DEG2RAD) as Radians,
      rangeRate,
      azimuthRate,
      elevationRate,
    );
  }

  ecf(date: Date = new Date()): EcfVec3<Kilometers> {
    const { gmst } = OrbitData.calculateTimeVariables(date);

    return eci2ecf(this.eci(date).position, gmst);
  }

  eci(date: Date = new Date()): PosVel<Kilometers, KilometersPerSecond> {
    return this.orbitData.propagate(date);
  }

  toJ2000(date: Date = new Date()): J2000 {
    const eci = this.orbitData.propagate(date);
    const p = eci.position;
    const v = eci.velocity;
    const epoch = new EpochUTC(date.getTime() / 1000 as Seconds);
    const pos = new Vector3D(p.x, p.y, p.z);
    const vel = new Vector3D(v.x, v.y, v.z);

    return new J2000(epoch, pos, vel);
  }

  el(observer: BaseObjectAdv, date: Date = new Date()): Degrees {
    return (this.rae(observer, date).el * RAD2DEG) as Degrees;
  }

  lla(date: Date = new Date()): LlaVec3<Degrees, Kilometers> {
    const { gmst } = OrbitData.calculateTimeVariables(date, this.orbitData.satrec);
    const pos = this.eci(date).position;
    const lla = eci2lla(pos, gmst);

    return lla;
  }

  llaRad(date: Date = new Date()): LlaVec3<Radians, Kilometers> {
    const lla = this.lla(date);

    return {
      lat: (lla.lat * DEG2RAD) as Radians,
      lon: (lla.lon * DEG2RAD) as Radians,
      alt: lla.alt,
    };
  }

  toGeodetic(date: Date = new Date()): Geodetic {
    return this.toJ2000(date).toITRF().toGeodetic();
  }

  toITRF(date: Date = new Date()): ITRF {
    return this.toJ2000(date).toITRF();
  }

  toRIC(reference: SatelliteAdv, date: Date = new Date()): RIC {
    return RIC.fromJ2000(this.toJ2000(date), reference.toJ2000(date));
  }

  toClassicalElements(date: Date = new Date()): ClassicalElements {
    return this.toJ2000(date).toClassicalElements();
  }

  rae(observer: BaseObjectAdv, date: Date = new Date()): RaeVec3<Kilometers, Degrees> {
    const { gmst } = OrbitData.calculateTimeVariables(date, this.orbitData.satrec);
    const eci = this.eci(date).position;
    const ecf = eci2ecf(eci, gmst);

    return ecf2rae(observer.lla(), ecf);
  }

  rng(observer: BaseObjectAdv, date: Date = new Date()): Kilometers {
    return this.rae(observer, date).rng;
  }

  applyDoppler(freq: number, observer: GroundObject, date?: Date): number {
    const doppler = this.dopplerFactor(observer, date);

    return freq * doppler;
  }

  dopplerFactor(observer: GroundObject, date?: Date): number {
    const position = this.eci(date);

    return dopplerFactor(observer.eci(date).position, position.position, position.velocity);
  }

  clone(): SatelliteAdv {
    return new SatelliteAdv({
      id: this.id,
      name: this.core.name,
      altId: this.core.altId,
      altName: this.core.altName,
      sccNum: this.core.sccNum,
      intlDes: this.core.intlDes,
      tle1: this.orbitData.tle1,
      tle2: this.orbitData.tle2,
      launchDate: this.launchInfo.launchDate,
      launchMass: this.launchInfo.launchMass,
      launchSite: this.launchInfo.launchSite,
      launchVehicle: this.launchInfo.launchVehicle,
      lifetime: this.spaceCraftDetails.lifetime,
      maneuver: this.spaceCraftDetails.maneuver,
      manufacturer: this.spaceCraftDetails.manufacturer,
      motor: this.spaceCraftDetails.motor,
      power: this.spaceCraftDetails.power,
      payload: this.spaceCraftDetails.payload,
      purpose: this.spaceCraftDetails.purpose,
      shape: this.spaceCraftDetails.shape,
      span: this.spaceCraftDetails.span,
      bus: this.spaceCraftDetails.bus,
      configuration: this.spaceCraftDetails.configuration,
      equipment: this.spaceCraftDetails.equipment,
      dryMass: this.spaceCraftDetails.dryMass,
      length: this.spaceCraftDetails.length,
      diameter: this.spaceCraftDetails.diameter,
      rcs: this.spaceCraftDetails.rcs,
      vmag: this.spaceCraftDetails.vmag,
      user: this.operationalInfo.user,
      mission: this.operationalInfo.mission,
      owner: this.operationalInfo.owner,
      country: this.operationalInfo.country,
    });
  }

  toJSON(): string {
    return JSON.stringify({
      ...JSON.parse(super.toJSON()),
      core: this.core,
      launchInfo: this.launchInfo,
      spaceCraftDetails: this.spaceCraftDetails,
      operationalInfo: this.operationalInfo,
      orbitData: this.orbitData,
    });
  }

  static fromJSON(json: string): SatelliteAdv {
    const data = JSON.parse(json);

    return new SatelliteAdv({
      id: data.id,
      name: data.core.name,
      altId: data.core.altId,
      altName: data.core.altName,
      sccNum: data.core.sccNum,
      intlDes: data.core.intlDes,
      tle1: data.orbitData.tle1,
      tle2: data.orbitData.tle2,
      launchDate: data.launchInfo.launchDate,
      launchMass: data.launchInfo.launchMass,
      launchSite: data.launchInfo.launchSite,
      launchVehicle: data.launchInfo.launchVehicle,
      lifetime: data.spaceCraftDetails.lifetime,
      maneuver: data.spaceCraftDetails.maneuver,
      manufacturer: data.spaceCraftDetails.manufacturer,
      motor: data.spaceCraftDetails.motor,
      power: data.spaceCraftDetails.power,
      payload: data.spaceCraftDetails.payload,
      purpose: data.spaceCraftDetails.purpose,
      shape: data.spaceCraftDetails.shape,
      span: data.spaceCraftDetails.span,
      bus: data.spaceCraftDetails.bus,
      configuration: data.spaceCraftDetails.configuration,
      equipment: data.spaceCraftDetails.equipment,
      dryMass: data.spaceCraftDetails.dryMass,
      length: data.spaceCraftDetails.length,
      diameter: data.spaceCraftDetails.diameter,
      rcs: data.spaceCraftDetails.rcs,
      vmag: data.spaceCraftDetails.vmag,
      user: data.operationalInfo.user,
      mission: data.operationalInfo.mission,
      owner: data.operationalInfo.owner,
      country: data.operationalInfo.country,
      attachedObjects: data.attachedObjects.map((attachedObject: string) => {
        // eslint-disable-next-line no-console
        console.error(attachedObject);

        return Serializer.classFromJSON(attachedObject);
      }),
    });
  }
}

