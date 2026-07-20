import { beforeEach, describe, expect, it } from 'vitest';
import { ScoreTracker, STARS_KEY, loadStarState } from '../lib/game/score.js';

function makeStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});

describe('NBucks star-pack fulfillment', () => {
  it('persists the grant and receipt together and ignores a replay', async () => {
    const tracker = new ScoreTracker(10);
    await expect(tracker.fulfillPurchasedStars(100, 'receipt-1')).resolves.toBe(true);
    await expect(tracker.fulfillPurchasedStars(100, 'receipt-1')).resolves.toBe(false);

    expect(tracker.stars).toBe(110);
    await expect(loadStarState()).resolves.toEqual({
      stars: 110,
      fulfilledNbucksReceipts: ['receipt-1'],
    });
  });

  it('loads the legacy primitive star format', async () => {
    localStorage.setItem(STARS_KEY, '4321');
    await expect(loadStarState()).resolves.toEqual({
      stars: 4321,
      fulfilledNbucksReceipts: [],
    });
  });
});
