import { describe, it, expect } from 'vitest';
import { pickOrientation } from '../lib/ui/orientation.js';

describe('pickOrientation', () => {
  it('returns landscape when width exceeds height', () => {
    expect(pickOrientation(800, 360)).toBe('landscape');
  });

  it('returns portrait when height exceeds width', () => {
    expect(pickOrientation(1080, 1920)).toBe('portrait');
  });

  it('treats a square box as portrait (w not greater than h)', () => {
    expect(pickOrientation(500, 500)).toBe('portrait');
  });
});
