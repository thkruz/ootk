// SpacecraftDetails.ts
export class SpacecraftDetails {
  lifetime!: string | number;
  maneuver!: string;
  manufacturer!: string;
  motor!: string;
  power!: string;
  payload!: string;
  purpose!: string;
  shape!: string;
  span!: string;
  bus!: string;
  configuration!: string;
  equipment!: string;
  dryMass!: string;
  length!: string;
  diameter!: string;
  rcs?: number | null = null;
  vmag?: number | null = null;

  constructor(params: Partial<SpacecraftDetails>) {
    Object.assign(this, {
      lifetime: '',
      maneuver: '',
      manufacturer: '',
      motor: '',
      power: '',
      payload: '',
      purpose: '',
      shape: '',
      span: '',
      bus: '',
      configuration: '',
      equipment: '',
      dryMass: '',
      length: '',
      diameter: '',
      rcs: null,
      vmag: null,
      ...params,
    });
  }
}
