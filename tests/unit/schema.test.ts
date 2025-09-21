import { describe, expect, it } from 'vitest';
import { tapDeltaEventSchema } from '@wedding_tool/schema';

describe('tapDeltaEventSchema', () => {
  it('accepts values in range', () => {
    expect(tapDeltaEventSchema.parse({ delta: 5 })).toEqual({ delta: 5 });
  });

  it('rejects out-of-range values', () => {
    expect(() => tapDeltaEventSchema.parse({ delta: 50 })).toThrowError();
  });
});
