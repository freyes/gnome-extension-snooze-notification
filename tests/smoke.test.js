// Copyright (C) 2026 Felipe Reyes
// SPDX-License-Identifier: GPL-2.0-or-later

// Smoke test: proves the runner, the fakes, and the virtual clock work before
// any product code exists.
import { FakeScheduler } from './fakes.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

assert(1 + 1 === 2, 'basic arithmetic');

const s = new FakeScheduler();
let fired = 0;
s.schedule(10, () => (fired += 1));
assert(fired === 0, 'not fired before advance');
assert(s.pending === 1, 'one pending job');
s.advance(10);
assert(fired === 1, 'fired after advance');
assert(s.pending === 0, 'no pending job after fire');

console.log('smoke.test.js: PASS');
