import { BaseObject, BaseObjectParams, EciVec3, Kilometers, SpaceObjectType } from '../../src/main';
const mockVelocity = {
  x: 8000,
  y: 0,
  z: 0,
} as EciVec3;
const mockPosition = {
  x: 4,
  y: 0,
  z: 0,
} as EciVec3;

describe('BaseObject', () => {
  // create a new BaseObject with valid parameters
  it('should create a new BaseObject with valid parameters', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.PAYLOAD,
      name: 'Satellite',
      position: mockPosition,
      velocity: mockVelocity,

      active: true,
    };

    const baseObject = new BaseObject(info);

    expect(baseObject.type).toBe(SpaceObjectType.PAYLOAD);
    expect(baseObject.name).toBe('Satellite');
    expect(baseObject.position.x).toBe(mockPosition.x);
    expect(baseObject.position.y).toBe(mockPosition.y);
    expect(baseObject.position.z).toBe(mockPosition.z);
    expect(baseObject.velocity.x).toBe(mockVelocity.x);
    expect(baseObject.velocity.y).toBe(mockVelocity.y);
    expect(baseObject.velocity.z).toBe(mockVelocity.z);
    expect(baseObject.active).toBe(true);
  });

  // create a new BaseObject with default parameters
  it('should create a new BaseObject with default parameters', () => {
    const baseObject = new BaseObject({});

    expect(baseObject.type).toBe(SpaceObjectType.UNKNOWN);
    expect(baseObject.name).toBe('Unknown');
    expect(baseObject.position.x).toBe(0);
    expect(baseObject.position.y).toBe(0);
    expect(baseObject.position.z).toBe(0);
    expect(baseObject.velocity.x).toBe(0);
    expect(baseObject.velocity.y).toBe(0);
    expect(baseObject.velocity.z).toBe(0);
    expect(baseObject.active).toBe(true);
  });

  // check if BaseObject is a satellite
  it('should return false when BaseObject is not a Satellite', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.PAYLOAD,
      name: 'Satellite',
    };

    const baseObject = new BaseObject(info);

    expect(baseObject.isSatellite()).toBe(false);
  });

  // check if BaseObject is a payload
  it('should return true when the object is a payload', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.PAYLOAD,
      name: 'Satellite',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    const result = baseObject.isPayload();

    expect(result).toBe(true);
  });

  // check if BaseObject is a rocket body
  it('should return true when the object is a rocket body', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.ROCKET_BODY,
      name: 'Rocket',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    const result = baseObject.isRocketBody();

    expect(result).toBe(true);
  });

  // check if BaseObject is debris
  it('should return true when the object is debris', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.DEBRIS,
      name: 'Debris',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    const result = baseObject.isDebris();

    expect(result).toBe(true);
  });

  // check if BaseObject is a star
  it('should return true when the object is a star', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.STAR,
      name: 'Star Object',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    const result = baseObject.isStar();

    expect(result).toBe(true);
  });

  // check if BaseObject is a missile
  it('should return true when the object is a missile', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.BALLISTIC_MISSILE,
      name: 'Missile',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    expect(baseObject.isMissile()).toBe(true);
  });

  // check if BaseObject is notional
  it('should return true when the object is notional', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.NOTIONAL,
      name: 'Notional Object',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    expect(baseObject.isNotional()).toBe(true);
  });

  // get BaseObject type string
  it('should return the correct type string when called getTypeString()', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.PAYLOAD,
      name: 'Satellite',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    const typeString = baseObject.getTypeString();

    expect(typeString).toBe('Payload');
  });

  // check if BaseObject is a sensor
  it('should return false when calling isSensor() method', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.PAYLOAD,
      name: 'Satellite',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    const result = baseObject.isSensor();

    expect(result).toBe(false);
  });

  // check if BaseObject is a marker
  it('should return false when calling isMarker() method on BaseObject instance', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.PAYLOAD,
      name: 'Satellite',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    const result = baseObject.isMarker();

    expect(result).toBe(false);
  });

  // check if BaseObject is static
  it('should return coorect value when calling isStatic() method', () => {
    const movingObject = new BaseObject({
      type: SpaceObjectType.PAYLOAD,
      name: 'Satellite',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    });
    const staticObject = new BaseObject({
      type: SpaceObjectType.PAYLOAD,
      name: 'Satellite',
      position: mockPosition,
      velocity: {
        x: 0 as Kilometers,
        y: 0 as Kilometers,
        z: 0 as Kilometers,
      },
      active: true,
    });

    expect(movingObject.isStatic()).toBe(false);
    expect(staticObject.isStatic()).toBe(true);
  });

  // check if BaseObject is a land object
  it('should return false when the object type is a different land object type', () => {
    const info: BaseObjectParams = {
      type: SpaceObjectType.GROUND_SENSOR_STATION,
      name: 'Ground Sensor Station',
      position: mockPosition,
      velocity: mockVelocity,
      active: true,
    };

    const baseObject = new BaseObject(info);

    const result = baseObject.isGroundObject();

    expect(result).toBe(false);
  });
});
