// LaunchInfo.ts
export class LaunchInfo {
  launchDate!: string;
  launchMass!: string;
  launchSite!: string;
  launchVehicle!: string;

  constructor(params: Partial<LaunchInfo>) {
    Object.assign(this, {
      launchDate: '',
      launchMass: '',
      launchSite: '',
      launchVehicle: '',
      ...params,
    });
  }
}
