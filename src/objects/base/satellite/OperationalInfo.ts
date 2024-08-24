export class OperationalInfo {
  active!: boolean;
  mission!: string;
  user!: string;
  owner!: string;
  country!: string;
  source!: string;
  altId!: string;
  altName!: string;

  constructor(params: Partial<OperationalInfo>) {
    Object.assign(this, {
      active: false,
      mission: '',
      user: '',
      owner: '',
      country: '',
      source: '',
      altId: '',
      altName: '',
      ...params,
    });
  }
}
