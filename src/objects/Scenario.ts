import { CommonBase } from './CommonBase.js';
import { Serializer } from './Serializer.js';
import { BaseObjectAdv } from './base/BaseObject.js';

export enum SurfaceAt {
  WGS84Ellipsoid,
  MeanSeaLevel,
}

export interface ScenarioParams {
  name: string;
  shortDescription?: string;
  longDescription?: string;
  currentTime: Date;
  startTime?: Date;
  stopTime?: Date;
  stepSize: number;
  isShowingLabels?: boolean;
  isShowingSensors?: boolean;
  isShowingGroundTracks?: boolean;
  isShowingOrbits?: boolean;
  isShowingGroundMarkers?: boolean;
  isShowingOrbitMarkers?: boolean;
  isShowingElsetNumber?: boolean;
  surfaceAt?: SurfaceAt;
}

export class Scenario extends CommonBase {
  name: string;
  currentTime: Date;
  startTime?: Date | null;
  stopTime?: Date | null;
  stepSize: number;
  isShowingLabels: boolean;
  isShowingSensors: boolean;
  isShowingGroundTracks: boolean;
  isShowingOrbits: boolean;
  isShowingGroundMarkers: boolean;
  isShowingOrbitMarkers: boolean;
  isShowingElsetNumber: boolean;
  surfaceAt: SurfaceAt;
  objects: BaseObjectAdv[];

  constructor(info: ScenarioParams) {
    super(info);
    this.validateScenarioInputData_(info);

    this.name = info.name;
    this.currentTime = info.currentTime;
    this.startTime = info.startTime;
    this.stopTime = info.stopTime;
    this.stepSize = info.stepSize;
    this.isShowingLabels = info.isShowingLabels ?? true;
    this.isShowingSensors = info.isShowingSensors ?? true;
    this.isShowingGroundTracks = info.isShowingGroundTracks ?? true;
    this.isShowingOrbits = info.isShowingOrbits ?? true;
    this.isShowingGroundMarkers = info.isShowingGroundMarkers ?? true;
    this.isShowingOrbitMarkers = info.isShowingOrbitMarkers ?? true;
    this.isShowingElsetNumber = info.isShowingElsetNumber ?? true;
    this.surfaceAt = info.surfaceAt ?? SurfaceAt.WGS84Ellipsoid;
    this.objects = [];
  }

  addObject(object: BaseObjectAdv): void {
    this.objects.push(object);
  }

  removeObject(object: BaseObjectAdv): void {
    const index = this.objects.indexOf(object);

    if (index > -1) {
      this.objects.splice(index, 1);
    }
  }

  toJSON(): string {
    return JSON.stringify({
      id: this.id,
      shortDescription: this.shortDescription,
      longDescription: this.longDescription,
      name: this.name,
      currentTime: this.currentTime.toISOString(),
      startTime: this.startTime?.toISOString(),
      stopTime: this.stopTime?.toISOString(),
      stepSize: this.stepSize,
      isShowingLabels: this.isShowingLabels,
      isShowingSensors: this.isShowingSensors,
      isShowingGroundTracks: this.isShowingGroundTracks,
      isShowingOrbits: this.isShowingOrbits,
      isShowingGroundMarkers: this.isShowingGroundMarkers,
      isShowingOrbitMarkers: this.isShowingOrbitMarkers,
      isShowingElsetNumber: this.isShowingElsetNumber,
      surfaceAt: this.surfaceAt,
      objects: this.objects,
    });
  }

  static fromJSON(json: string): Scenario {
    const data = JSON.parse(json);
    const scenario = new Scenario({
      name: data.name,
      currentTime: new Date(data.currentTime),
      stepSize: data.stepSize,
    });

    scenario.id = data.id;
    scenario.shortDescription = data.shortDescription;
    scenario.longDescription = data.longDescription;
    scenario.startTime = data.startTime ? new Date(data.startTime) : null;
    scenario.stopTime = data.stopTime ? new Date(data.stopTime) : null;
    scenario.isShowingLabels = data.isShowingLabels;
    scenario.isShowingSensors = data.isShowingSensors;
    scenario.isShowingGroundTracks = data.isShowingGroundTracks;
    scenario.isShowingOrbits = data.isShowingOrbits;
    scenario.isShowingGroundMarkers = data.isShowingGroundMarkers;
    scenario.isShowingOrbitMarkers = data.isShowingOrbitMarkers;
    scenario.isShowingElsetNumber = data.isShowingElsetNumber;
    scenario.surfaceAt = data.surfaceAt;

    // Deserialize objects
    scenario.objects = data.objects.map((obj: BaseObjectAdv) => Serializer.classFromJSON(JSON.stringify(obj)));

    return scenario;
  }

  private validateScenarioInputData_(info: ScenarioParams): void {
    if (!info.name) {
      throw new Error('Scenario name is required');
    }
    if (!info.currentTime) {
      throw new Error('Current time is required');
    }
    if (!info.stepSize || info.stepSize <= 0) {
      throw new Error('Step size must be a positive number');
    }
    if (info.startTime && info.stopTime && info.startTime > info.stopTime) {
      throw new Error('Start time must be before stop time');
    }
  }
}
