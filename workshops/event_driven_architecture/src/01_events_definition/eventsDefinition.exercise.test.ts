import { describe, expect, it } from 'vitest';

// 1. Define your events here

describe('Events definition', () => {
  it('Guest Stay Account event types are defined', () => {
    const events: { type: string }[] = [
      // 2. Put your sample events here
    ];

    expect(events.length).toBe(5);
    expect(new Set(events.map((event) => event.type)).size).toBe(5);
  });

  it('Group Checkout event types are defined', () => {
    const events: { type: string }[] = [
      // 2. Put your sample events here
    ];

    expect(events.length).toBe(5);
    expect(new Set(events.map((event) => event.type)).size).toBe(5);
  });
});
