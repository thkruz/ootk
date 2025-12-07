/**
 * @file CdmExporter test suite
 * @description Tests for CDM KVN format export
 */

import {
  CdmExporter,
  CdmParser,
  ConjunctionEvent,
  CovarianceFrame,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Matrix,
  RIC,
  StateCovariance,
  Vector3D,
} from '../../main';

describe('CdmExporter', () => {
  // Create a test conjunction event
  function createTestEvent(includeCovariance = true): ConjunctionEvent {
    const tca = EpochUTC.fromDateTimeString('2025-01-20T15:30:45.123Z');
    const primaryPos = new Vector3D<Kilometers>(6878.137 as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const primaryVel = new Vector3D<KilometersPerSecond>(
      0 as KilometersPerSecond, 7.612 as KilometersPerSecond, 0 as KilometersPerSecond,
    );
    const secondaryPos = new Vector3D<Kilometers>(6878.637 as Kilometers, 0.1 as Kilometers, 0.35 as Kilometers);
    const secondaryVel = new Vector3D<KilometersPerSecond>(
      0.001 as KilometersPerSecond, 7.612 as KilometersPerSecond, 0.001 as KilometersPerSecond,
    );

    const primaryState = new J2000(tca, primaryPos, primaryVel);
    const secondaryState = new J2000(tca, secondaryPos, secondaryVel);
    const relativeState = RIC.fromJ2000(secondaryState, primaryState);

    let covariance: StateCovariance | undefined;

    if (includeCovariance) {
      covariance = new StateCovariance(
        new Matrix([
          [1e-6, 0, 0, 0, 0, 0],
          [0, 1e-6, 0, 0, 0, 0],
          [0, 0, 1e-6, 0, 0, 0],
          [0, 0, 0, 1e-9, 0, 0],
          [0, 0, 0, 0, 1e-9, 0],
          [0, 0, 0, 0, 0, 1e-9],
        ]),
        CovarianceFrame.RIC,
      );
    }

    return new ConjunctionEvent({
      tca,
      primaryState,
      secondaryState,
      relativeState,
      missDistance: 0.5 as Kilometers,
      radialDistance: 0.1 as Kilometers,
      intrackDistance: 0.3 as Kilometers,
      crosstrackDistance: 0.35 as Kilometers,
      relativeVelocity: 14.2 as KilometersPerSecond,
      combinedCovariance: covariance,
      probabilityOfCollision: 1.5e-5,
      primaryRadius: 0.01 as Kilometers,
      secondaryRadius: 0.005 as Kilometers,
    });
  }

  describe('export', () => {
    it('should export ConjunctionEvent to CDM string', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toBeDefined();
      expect(typeof cdm).toBe('string');
      expect(cdm.length).toBeGreaterThan(0);
    });

    it('should include CDM version header', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('CCSDS_CDM_VERS = 1.0');
    });

    it('should include creation date', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('CREATION_DATE =');
    });

    it('should include originator', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event, { originator: 'TEST_ORG' });

      expect(cdm).toContain('ORIGINATOR = TEST_ORG');
    });

    it('should use default originator if not specified', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('ORIGINATOR = OOTK');
    });

    it('should include message ID if specified', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event, { messageId: 'CDM-2025-001' });

      expect(cdm).toContain('MESSAGE_ID = CDM-2025-001');
    });

    it('should include TCA', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('TCA =');
      expect(cdm).toContain('2025-01-20');
    });

    it('should include miss distance', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('MISS_DISTANCE =');
      expect(cdm).toContain('[km]');
    });

    it('should include relative position components', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('RELATIVE_POSITION_R =');
      expect(cdm).toContain('RELATIVE_POSITION_T =');
      expect(cdm).toContain('RELATIVE_POSITION_N =');
    });

    it('should include relative velocity components', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('RELATIVE_SPEED =');
      expect(cdm).toContain('RELATIVE_VELOCITY_R =');
      expect(cdm).toContain('RELATIVE_VELOCITY_T =');
      expect(cdm).toContain('RELATIVE_VELOCITY_N =');
    });

    it('should include collision probability if available', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('COLLISION_PROBABILITY =');
      expect(cdm).toContain('COLLISION_PROBABILITY_METHOD = CHAN-2D');
    });

    it('should include object sections', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('OBJECT = OBJECT1');
      expect(cdm).toContain('OBJECT = OBJECT2');
    });

    it('should include object state vectors', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('X =');
      expect(cdm).toContain('Y =');
      expect(cdm).toContain('Z =');
      expect(cdm).toContain('X_DOT =');
      expect(cdm).toContain('Y_DOT =');
      expect(cdm).toContain('Z_DOT =');
    });

    it('should include covariance data when available', () => {
      const event = createTestEvent(true);
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('CR_R =');
      expect(cdm).toContain('CT_T =');
      expect(cdm).toContain('CN_N =');
    });

    it('should include object metadata if provided', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event, {
        object1Metadata: {
          OBJECT_DESIGNATOR: '25544',
          OBJECT_NAME: 'ISS',
          OBJECT_TYPE: 'PAYLOAD',
        },
        object2Metadata: {
          OBJECT_DESIGNATOR: '12345',
          OBJECT_NAME: 'DEBRIS',
          OBJECT_TYPE: 'DEBRIS',
        },
      });

      expect(cdm).toContain('OBJECT_DESIGNATOR = 25544');
      expect(cdm).toContain('OBJECT_NAME = ISS');
      expect(cdm).toContain('OBJECT_TYPE = PAYLOAD');
      expect(cdm).toContain('OBJECT_DESIGNATOR = 12345');
      expect(cdm).toContain('OBJECT_NAME = DEBRIS');
    });

    it('should include reference frame', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('REF_FRAME =');
    });

    it('should include comments if provided', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event, {
        comments: ['Test comment 1', 'Test comment 2'],
      });

      expect(cdm).toContain('COMMENT Test comment 1');
      expect(cdm).toContain('COMMENT Test comment 2');
    });

    it('should export event without covariance', () => {
      const event = createTestEvent(false);
      const cdm = CdmExporter.export(event);

      expect(cdm).toBeDefined();
      expect(cdm).not.toContain('CR_R =');
    });
  });

  describe('exportMultiple', () => {
    it('should export multiple events', () => {
      const events = [createTestEvent(), createTestEvent()];
      const cdms = CdmExporter.exportMultiple(events);

      expect(cdms).toHaveLength(2);
      expect(cdms[0]).toContain('CCSDS_CDM_VERS');
      expect(cdms[1]).toContain('CCSDS_CDM_VERS');
    });

    it('should generate unique message IDs', () => {
      const events = [createTestEvent(), createTestEvent()];
      const cdms = CdmExporter.exportMultiple(events, { messageId: 'CDM-BASE' });

      expect(cdms[0]).toContain('MESSAGE_ID = CDM-BASE-1');
      expect(cdms[1]).toContain('MESSAGE_ID = CDM-BASE-2');
    });
  });

  describe('round-trip', () => {
    it('should round-trip export and parse', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event, {
        object1Metadata: { OBJECT_DESIGNATOR: '25544' },
        object2Metadata: { OBJECT_DESIGNATOR: '12345' },
      });

      // Parse the exported CDM
      const parsed = CdmParser.parse(cdm);

      // Convert back to event
      const roundTripped = CdmParser.toConjunctionEvent(parsed);

      // Compare key values
      expect(roundTripped.missDistance).toBeCloseTo(event.missDistance, 6);
      expect(roundTripped.radialDistance).toBeCloseTo(event.radialDistance, 6);
      expect(roundTripped.intrackDistance).toBeCloseTo(event.intrackDistance, 6);
      expect(roundTripped.crosstrackDistance).toBeCloseTo(event.crosstrackDistance, 6);
      expect(roundTripped.relativeVelocity).toBeCloseTo(event.relativeVelocity, 6);

      if (event.probabilityOfCollision !== undefined) {
        expect(roundTripped.probabilityOfCollision).toBeCloseTo(event.probabilityOfCollision, 10);
      }
    });

    it('should preserve state vectors in round-trip', () => {
      const event = createTestEvent();
      const cdm = CdmExporter.export(event, {
        object1Metadata: { OBJECT_DESIGNATOR: '25544' },
        object2Metadata: { OBJECT_DESIGNATOR: '12345' },
      });

      const parsed = CdmParser.parse(cdm);
      const roundTripped = CdmParser.toConjunctionEvent(parsed);

      // Primary state
      expect(roundTripped.primaryState.position.x).toBeCloseTo(event.primaryState.position.x, 6);
      expect(roundTripped.primaryState.position.y).toBeCloseTo(event.primaryState.position.y, 6);
      expect(roundTripped.primaryState.position.z).toBeCloseTo(event.primaryState.position.z, 6);
      expect(roundTripped.primaryState.velocity.x).toBeCloseTo(event.primaryState.velocity.x, 6);
      expect(roundTripped.primaryState.velocity.y).toBeCloseTo(event.primaryState.velocity.y, 6);
      expect(roundTripped.primaryState.velocity.z).toBeCloseTo(event.primaryState.velocity.z, 6);

      // Secondary state
      expect(roundTripped.secondaryState.position.x).toBeCloseTo(event.secondaryState.position.x, 6);
      expect(roundTripped.secondaryState.position.y).toBeCloseTo(event.secondaryState.position.y, 6);
      expect(roundTripped.secondaryState.position.z).toBeCloseTo(event.secondaryState.position.z, 6);
    });
  });
});
