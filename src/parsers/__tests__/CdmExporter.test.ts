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
      // Signed RIC components consistent with the two states (CCSDS 508 RELATIVE_POSITION_R/T/N)
      missDistance: relativeState.range,
      radialDistance: relativeState.position.x,
      intrackDistance: relativeState.position.y,
      crosstrackDistance: relativeState.position.z,
      relativeVelocity: relativeState.velocity.magnitude(),
      radialVelocity: relativeState.velocity.x,
      intrackVelocity: relativeState.velocity.y,
      crosstrackVelocity: relativeState.velocity.z,
      combinedCovariance: covariance,
      // CDM covariances are per object (CCSDS 508.0-B-1 Table 3-4); combinedCovariance is not written
      primaryCovariance: covariance,
      secondaryCovariance: covariance,
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
      // FOSTER-1992 (SANA registry) is the exact 2D integral ProbabilityOfCollision computes; CHAN-2D is not a registry value
      expect(cdm).toContain('COLLISION_PROBABILITY_METHOD = FOSTER-1992');
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
      // Signed velocity components survive the round trip as well
      expect(roundTripped.radialVelocity).toBeCloseTo(event.radialVelocity!, 6);
      expect(roundTripped.intrackVelocity).toBeCloseTo(event.intrackVelocity!, 6);
      expect(roundTripped.crosstrackVelocity).toBeCloseTo(event.crosstrackVelocity!, 6);

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

  /*
   * Verifier fix M.3: RELATIVE_POSITION_* and RELATIVE_VELOCITY_* come from one source. With
   * stored velocity components the stored (signed) fields are written; without them both are
   * recomputed from the states, never a stored position next to a recomputed velocity.
   */
  describe('relative state source', () => {
    const valueOf = (cdm: string, key: string): number => {
      const line = cdm.split(/\r?\n/u).find((l) => l.startsWith(`${key} =`));

      return parseFloat(line!.split('=')[1]);
    };

    it('writes the stored signed fields when the event carries relative velocity components', () => {
      const base = createTestEvent(false);
      const event = new ConjunctionEvent({
        ...base,
        radialDistance: -0.111 as Kilometers,
        intrackDistance: -0.222 as Kilometers,
        crosstrackDistance: 0.333 as Kilometers,
        radialVelocity: -0.001 as KilometersPerSecond,
        intrackVelocity: 0.002 as KilometersPerSecond,
        crosstrackVelocity: -0.003 as KilometersPerSecond,
      });
      const cdm = CdmExporter.export(event);

      expect(valueOf(cdm, 'RELATIVE_POSITION_R')).toBeCloseTo(-111, 6);
      expect(valueOf(cdm, 'RELATIVE_POSITION_T')).toBeCloseTo(-222, 6);
      expect(valueOf(cdm, 'RELATIVE_POSITION_N')).toBeCloseTo(333, 6);
      expect(valueOf(cdm, 'RELATIVE_VELOCITY_R')).toBeCloseTo(-1, 6);
      expect(valueOf(cdm, 'RELATIVE_VELOCITY_T')).toBeCloseTo(2, 6);
      expect(valueOf(cdm, 'RELATIVE_VELOCITY_N')).toBeCloseTo(-3, 6);
    });

    it('recomputes both position and velocity from the states when no velocity components are stored', () => {
      const base = createTestEvent(false);
      const event = new ConjunctionEvent({
        ...base,
        radialDistance: 99 as Kilometers,
        intrackDistance: 99 as Kilometers,
        crosstrackDistance: 99 as Kilometers,
        radialVelocity: undefined,
        intrackVelocity: undefined,
        crosstrackVelocity: undefined,
      });
      const ric = RIC.fromJ2000(event.secondaryState, event.primaryState);
      const cdm = CdmExporter.export(event);

      expect(valueOf(cdm, 'RELATIVE_POSITION_R')).toBeCloseTo(ric.position.x * 1000, 3);
      expect(valueOf(cdm, 'RELATIVE_POSITION_T')).toBeCloseTo(ric.position.y * 1000, 3);
      expect(valueOf(cdm, 'RELATIVE_POSITION_N')).toBeCloseTo(ric.position.z * 1000, 3);
      expect(valueOf(cdm, 'RELATIVE_VELOCITY_R')).toBeCloseTo(ric.velocity.x * 1000, 3);
      expect(valueOf(cdm, 'RELATIVE_VELOCITY_T')).toBeCloseTo(ric.velocity.y * 1000, 3);
      expect(valueOf(cdm, 'RELATIVE_VELOCITY_N')).toBeCloseTo(ric.velocity.z * 1000, 3);
    });

    it('exports and re-parses INTERNATIONAL_DESIGNATOR, MANEUVERABLE, EPHEMERIS_NAME and the screening volume', () => {
      const base = createTestEvent(false);
      const event = new ConjunctionEvent({
        ...base,
        primaryDesignator: '25544',
        secondaryDesignator: '12345',
        primaryInternationalDesignator: '1998-067A',
        secondaryInternationalDesignator: '1981-053A',
        primaryManeuverable: 'YES',
        secondaryManeuverable: 'NO',
        primaryEphemerisName: 'ISS_EPH_2025',
        secondaryEphemerisName: 'NONE',
        screenVolume: {
          startScreenPeriod: '2025-01-19T00:00:00.000',
          stopScreenPeriod: '2025-01-26T00:00:00.000',
          frame: 'RTN',
          shape: 'ELLIPSOID',
          x: 0.2 as Kilometers,
          y: 1 as Kilometers,
          z: 1 as Kilometers,
          entryTime: '2025-01-20T15:30:40.000',
          exitTime: '2025-01-20T15:30:50.000',
        },
      });
      const cdm = CdmExporter.export(event);

      expect(cdm).toContain('INTERNATIONAL_DESIGNATOR = 1998-067A');
      expect(cdm).toContain('INTERNATIONAL_DESIGNATOR = 1981-053A');
      expect(cdm).toContain('MANEUVERABLE = YES');
      expect(cdm).toContain('MANEUVERABLE = NO');
      expect(cdm).toContain('EPHEMERIS_NAME = ISS_EPH_2025');
      expect(cdm).toContain('SCREEN_VOLUME_SHAPE = ELLIPSOID');
      expect(valueOf(cdm, 'SCREEN_VOLUME_X')).toBeCloseTo(200, 9);

      const back = CdmParser.toConjunctionEvent(CdmParser.parse(cdm));

      expect(back.primaryInternationalDesignator).toBe('1998-067A');
      expect(back.secondaryManeuverable).toBe('NO');
      expect(back.primaryEphemerisName).toBe('ISS_EPH_2025');
      expect(back.screenVolume?.frame).toBe('RTN');
      expect(back.screenVolume?.x).toBeCloseTo(0.2, 12);
      expect(back.screenVolume?.y).toBeCloseTo(1, 12);
      expect(back.screenVolume?.stopScreenPeriod).toBe('2025-01-26T00:00:00.000');
      expect(back.screenVolume?.exitTime).toBe('2025-01-20T15:30:50.000');
    });
  });
});
