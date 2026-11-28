import { describe, it, expect } from 'vitest';
import { isEmbedded } from '../../utils/embed';

describe('isEmbedded', () => {
  it('is false in a normal top-level window (jsdom default)', () => {
    expect(isEmbedded()).toBe(false);
  });

  it('is true when self and top differ (inside an iframe)', () => {
    const frame = { self: {}, top: {} };
    frame.self = frame;
    frame.top = { different: true };
    expect(isEmbedded(frame)).toBe(true);
  });

  it('is false when self === top', () => {
    const w = {};
    w.self = w;
    w.top = w;
    expect(isEmbedded(w)).toBe(false);
  });
});
