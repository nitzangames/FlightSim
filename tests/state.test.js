import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from '../lib/game/state.js';

describe('StateMachine', () => {
  it('fires enter on start', () => {
    const enter = vi.fn();
    const sm = new StateMachine({ initial: 'A', states: { A: { enter } } });
    sm.start();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('transitions: fires exit on current then enter on next', () => {
    const calls = [];
    const sm = new StateMachine({
      initial: 'A',
      states: {
        A: { enter: () => calls.push('A.enter'), exit: () => calls.push('A.exit') },
        B: { enter: () => calls.push('B.enter') },
      },
    });
    sm.start();
    sm.setState('B');
    expect(calls).toEqual(['A.enter', 'A.exit', 'B.enter']);
  });

  it('update calls current state update', () => {
    const update = vi.fn();
    const sm = new StateMachine({ initial: 'A', states: { A: { update } } });
    sm.start();
    sm.update(0.016);
    expect(update).toHaveBeenCalledWith(0.016);
  });

  it('update before start is a no-op', () => {
    const update = vi.fn();
    const sm = new StateMachine({ initial: 'A', states: { A: { update } } });
    sm.update(0.016);
    expect(update).not.toHaveBeenCalled();
  });

  it('setState to unknown name throws', () => {
    const sm = new StateMachine({ initial: 'A', states: { A: {} } });
    sm.start();
    expect(() => sm.setState('NOPE')).toThrow(/unknown state NOPE/);
  });
});
