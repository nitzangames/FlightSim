// Generic finite state machine with enter/exit/update hooks.
// Game-specific state bodies are wired in shell/main.js.

export class StateMachine {
  constructor({ initial, states }) {
    if (!states[initial]) throw new Error('unknown initial state ' + initial);
    this.states = states;
    this.current = initial;
    this._started = false;
  }
  start() {
    if (this._started) return;
    this._started = true;
    const s = this.states[this.current];
    if (s.enter) s.enter();
  }
  setState(name) {
    const next = this.states[name];
    if (!next) throw new Error('unknown state ' + name);
    if (this._started) {
      const cur = this.states[this.current];
      if (cur.exit) cur.exit();
    }
    this.current = name;
    if (this._started && next.enter) next.enter();
  }
  update(dt) {
    if (!this._started) return;
    const s = this.states[this.current];
    if (s.update) s.update(dt);
  }
}
