import { displayToKg, formatWeight, kgToDisplay, parseNumericInput, stepForUnit } from './units';

describe('units', () => {
  it('round-trips kg↔lb without drift at display precision', () => {
    expect(kgToDisplay(100, 'lb')).toBeCloseTo(220.46, 2);
    expect(displayToKg(kgToDisplay(82.5, 'lb'), 'lb')).toBeCloseTo(82.5, 2);
    expect(kgToDisplay(82.5, 'kg')).toBe(82.5);
  });

  it('formats weights per unit and bodyweight mode', () => {
    expect(formatWeight(82.5, 'kg')).toBe('82.5 kg');
    expect(formatWeight(0, 'kg', true)).toBe('BW');
    expect(formatWeight(10, 'kg', true)).toBe('BW+10kg');
  });

  it('maps stepper increments to plate-sensible values per unit', () => {
    expect(stepForUnit(2.5, 'kg')).toBe(2.5);
    expect(stepForUnit(1.25, 'lb')).toBe(2.5);
    expect(stepForUnit(2.5, 'lb')).toBe(5);
    expect(stepForUnit(5, 'lb')).toBe(10);
  });

  it('parses gym-keyboard input defensively', () => {
    expect(parseNumericInput('82.5')).toBe(82.5);
    expect(parseNumericInput('82,5')).toBe(82.5);
    expect(parseNumericInput('')).toBe(0);
    expect(parseNumericInput('abc')).toBe(0);
    expect(parseNumericInput('-5')).toBe(0);
  });
});
