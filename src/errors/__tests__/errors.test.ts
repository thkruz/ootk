import {
  OotkError,
  OrbitDeterminationError,
  ParseError,
  PropagationError,
  ValidationError,
} from '../index';

describe('Custom Error Classes', () => {
  describe('OotkError', () => {
    it('should create an error with correct name and message', () => {
      const error = new OotkError('Test error message');

      expect(error.name).toBe('OotkError');
      expect(error.message).toBe('Test error message');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OotkError);
    });

    it('should have a stack trace', () => {
      const error = new OotkError('Test error');

      expect(error.stack).toBeDefined();
    });
  });

  describe('ValidationError', () => {
    it('should create an error with message only', () => {
      const error = new ValidationError('Invalid value');

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid value');
      expect(error.field).toBeUndefined();
      expect(error.value).toBeUndefined();
      expect(error).toBeInstanceOf(OotkError);
    });

    it('should create an error with field and value', () => {
      const error = new ValidationError(
        'Efficiency must be between 0 and 1',
        'efficiency',
        1.5,
      );

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Efficiency must be between 0 and 1');
      expect(error.field).toBe('efficiency');
      expect(error.value).toBe(1.5);
    });

    it('should handle various value types', () => {
      const errorWithObject = new ValidationError('Invalid config', 'config', { foo: 'bar' });

      expect(errorWithObject.value).toEqual({ foo: 'bar' });

      const errorWithNull = new ValidationError('Null not allowed', 'data', null);

      expect(errorWithNull.value).toBeNull();
    });
  });

  describe('ParseError', () => {
    it('should create an error with message only', () => {
      const error = new ParseError('Malformed data');

      expect(error.name).toBe('ParseError');
      expect(error.message).toBe('Malformed data');
      expect(error.format).toBeUndefined();
      expect(error.line).toBeUndefined();
      expect(error).toBeInstanceOf(OotkError);
    });

    it('should create an error with format', () => {
      const error = new ParseError('Invalid TLE format', 'TLE');

      expect(error.format).toBe('TLE');
      expect(error.line).toBeUndefined();
    });

    it('should create an error with format and line number', () => {
      const error = new ParseError('Invalid eccentricity', 'TLE', 2);

      expect(error.format).toBe('TLE');
      expect(error.line).toBe(2);
    });

    it('should handle different format types', () => {
      const oemError = new ParseError('Missing data block', 'OEM');

      expect(oemError.format).toBe('OEM');

      const horizonsError = new ParseError('Missing markers', 'HORIZONS');

      expect(horizonsError.format).toBe('HORIZONS');
    });
  });

  describe('PropagationError', () => {
    it('should create an error with message only', () => {
      const error = new PropagationError('Propagation failed');

      expect(error.name).toBe('PropagationError');
      expect(error.message).toBe('Propagation failed');
      expect(error.epoch).toBeUndefined();
      expect(error).toBeInstanceOf(OotkError);
    });

    it('should create an error with epoch', () => {
      const epoch = new Date('2025-01-15T12:00:00Z');
      const error = new PropagationError('Non-finite position computed', epoch);

      expect(error.epoch).toBe(epoch);
      expect(error.epoch?.toISOString()).toBe('2025-01-15T12:00:00.000Z');
    });
  });

  describe('OrbitDeterminationError', () => {
    it('should create an error with message only', () => {
      const error = new OrbitDeterminationError('Convergence failed');

      expect(error.name).toBe('OrbitDeterminationError');
      expect(error.message).toBe('Convergence failed');
      expect(error.algorithm).toBeUndefined();
      expect(error).toBeInstanceOf(OotkError);
    });

    it('should create an error with algorithm name', () => {
      const error = new OrbitDeterminationError('Failed to converge after 100 iterations', 'Gooding');

      expect(error.algorithm).toBe('Gooding');
    });

    it('should handle various algorithm names', () => {
      const gaussError = new OrbitDeterminationError('Initial estimate failed', 'Gauss');

      expect(gaussError.algorithm).toBe('Gauss');

      const lambertError = new OrbitDeterminationError('No solution found', 'Lambert');

      expect(lambertError.algorithm).toBe('Lambert');

      const gibbsError = new OrbitDeterminationError('Orbits not coplanar', 'Gibbs');

      expect(gibbsError.algorithm).toBe('Gibbs');
    });
  });

  describe('Error Hierarchy', () => {
    it('all custom errors should inherit from OotkError', () => {
      expect(new ValidationError('test')).toBeInstanceOf(OotkError);
      expect(new ParseError('test')).toBeInstanceOf(OotkError);
      expect(new PropagationError('test')).toBeInstanceOf(OotkError);
      expect(new OrbitDeterminationError('test')).toBeInstanceOf(OotkError);
    });

    it('all custom errors should inherit from Error', () => {
      expect(new ValidationError('test')).toBeInstanceOf(Error);
      expect(new ParseError('test')).toBeInstanceOf(Error);
      expect(new PropagationError('test')).toBeInstanceOf(Error);
      expect(new OrbitDeterminationError('test')).toBeInstanceOf(Error);
    });

    it('should be catchable with try-catch', () => {
      expect(() => {
        throw new ValidationError('test');
      }).toThrow(ValidationError);

      expect(() => {
        throw new ParseError('test');
      }).toThrow(ParseError);

      expect(() => {
        throw new PropagationError('test');
      }).toThrow(PropagationError);

      expect(() => {
        throw new OrbitDeterminationError('test');
      }).toThrow(OrbitDeterminationError);
    });

    it('custom errors can be caught as OotkError', () => {
      const errors = [
        new ValidationError('test'),
        new ParseError('test'),
        new PropagationError('test'),
        new OrbitDeterminationError('test'),
      ];

      for (const error of errors) {
        expect(() => {
          throw error;
        }).toThrow(OotkError);
      }
    });
  });
});
