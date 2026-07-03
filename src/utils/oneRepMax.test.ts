import { epley1Rm } from './oneRepMax';

describe('epley1Rm', () => {
  it('computes the Epley estimate', () => {
    expect(epley1Rm(100, 5)).toBeCloseTo(116.67, 2);
    expect(epley1Rm(80, 8)).toBeCloseTo(101.33, 2);
  });

  it('returns the weight itself for a single', () => {
    expect(epley1Rm(140, 1)).toBe(140);
  });

  it('returns null for bodyweight/empty entries', () => {
    expect(epley1Rm(0, 8)).toBeNull();
    expect(epley1Rm(100, 0)).toBeNull();
  });
});
