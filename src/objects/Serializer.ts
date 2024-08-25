import { SimpleConicSensor, ComplexConicSensor, RectangularSensor, Facility, MarkerAdv, SatelliteAdv } from '../main.js';

export class Serializer {
  static readonly version = '1.0.0';
  static readonly attachableClasses = [SimpleConicSensor, ComplexConicSensor, RectangularSensor];
  static readonly objectClasses = [Facility, SatelliteAdv, MarkerAdv];
  static classFromJSON(attachedObject: string) {
    const className = attachedObject.split(' ')[0];
    const json = attachedObject.slice(className.length + 1);

    const foundClass = Serializer.objectClasses.find((objectClass) => objectClass.name === className);

    if (foundClass) {
      return foundClass.fromJSON(json);
    }

    const foundAttachableClass = Serializer.attachableClasses.find((attachableClass) => attachableClass.name === className);

    if (foundAttachableClass) {
      return foundAttachableClass.fromJSON(json);
    }

    throw new Error(`Unknown class name: ${className}`);
  }
}
