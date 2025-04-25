import * as ootk from '../src/main';

describe('ootk-core', () => {
  it('should export Celestial', () => {
    expect(ootk.Celestial).toBeDefined();
  });
  it('should export Earth', () => {
    expect(ootk.Earth).toBeDefined();
  });
  it('should export Moon', () => {
    expect(ootk.Moon).toBeDefined();
  });
  it('should export Sun', () => {
    expect(ootk.Sun).toBeDefined();
  });
  it('should export Tle', () => {
    expect(ootk.Tle).toBeDefined();
  });
  it('should export DataHandler', () => {
    expect(ootk.DataHandler).toBeDefined();
  });
  it('should export BaseObject', () => {
    expect(ootk.BaseObject).toBeDefined();
  });
  it('should export GroundPosition', () => {
    expect(ootk.GroundObject).toBeDefined();
  });
  it('should export Satellite', () => {
    expect(ootk.Satellite).toBeDefined();
  });
  it('should export Sensor', () => {
    expect(ootk.Sensor).toBeDefined();
  });
  it('should export Star', () => {
    expect(ootk.Star).toBeDefined();
  });
});
