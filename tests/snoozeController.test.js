// Copyright (C) 2026 Felipe Reyes
// SPDX-License-Identifier: GPL-2.0-or-later

// Unit tests for the pure SnoozeController (lib/snoozeController.js).
// Deterministic: all timing flows through FakeScheduler.advance(), never wall
// clock, never gi:///resource:// imports.
import { SnoozeController } from '../lib/snoozeController.js';
import {
  FakeScheduler,
  FakeTrayAdapter,
  FakeNotification,
} from './fakes.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

function harness(onReshow) {
  const scheduler = new FakeScheduler();
  const adapter = new FakeTrayAdapter();
  const controller = new SnoozeController({ trayAdapter: adapter, scheduler, onReshow });
  return { scheduler, adapter, controller };
}

const M = 60;

// (a) snooze() hides the banner, forces isTransient false, and registers.
{
  const { scheduler, adapter, controller } = harness();
  const n = new FakeNotification();
  n.isTransient = true;

  controller.snooze(n, 5);

  assert(adapter.hideCalls === 1, 'hide called exactly once');
  assert(adapter._lastHidden === n, 'hide passed the notification');
  assert(n.isTransient === false, 'isTransient forced false while snoozed');
  assert(controller.isSnoozed(n) === true, 'isSnoozed true after snooze');
  assert(scheduler.pending === 1, 'one timer scheduled');
}

// (b) after the delay, requestReshow is called and the snooze clears.
{
  const { scheduler, adapter, controller } = harness();
  const n = new FakeNotification();
  controller.snooze(n, 5);

  scheduler.advance(5 * M);

  assert(adapter.reshowCalls === 1, 'reshow called exactly once');
  assert(adapter._lastReshown === n, 'reshow passed the notification');
  assert(controller.isSnoozed(n) === false, 'isSnoozed false after reshow');
  assert(scheduler.pending === 0, 'no pending timer after reshow');
}

// (c) reshow must not fire before the full delay elapses.
{
  const { scheduler, adapter, controller } = harness();
  const n = new FakeNotification();
  controller.snooze(n, 5);

  scheduler.advance(5 * M - 1);

  assert(adapter.reshowCalls === 0, 'no reshow before the delay');
  assert(controller.isSnoozed(n) === true, 'still snoozed before the delay');
}

// (d) cancel() removes the timer; advancing past the delay does nothing.
{
  const { scheduler, adapter, controller } = harness();
  const n = new FakeNotification();
  controller.snooze(n, 5);

  controller.cancel(n);

  assert(controller.isSnoozed(n) === false, 'isSnoozed false after cancel');
  scheduler.advance(3600);
  assert(adapter.reshowCalls === 0, 'no reshow after cancel');
  assert(scheduler.pending === 0, 'timer removed on cancel');
}

// (e) a destroyed notification auto-cancels its snooze.
{
  const { scheduler, controller } = harness();
  const n = new FakeNotification();
  controller.snooze(n, 5);

  n.emitDestroy();

  assert(controller.isSnoozed(n) === false, 'isSnoozed false after destroy');
  assert(scheduler.pending === 0, 'timer removed on destroy');
}

// (f) two concurrent snoozes re-show independently, in their own order.
{
  const { scheduler, adapter, controller } = harness();
  const a = new FakeNotification();
  const b = new FakeNotification();
  controller.snooze(a, 5);
  controller.snooze(b, 10);

  assert(scheduler.pending === 2, 'two timers scheduled');

  scheduler.advance(5 * M);
  assert(adapter.reshowCalls === 1, 'only the 5-min snooze fired first');
  assert(controller.isSnoozed(a) === false, 'a cleared');
  assert(controller.isSnoozed(b) === true, 'b still snoozed');

  scheduler.advance(5 * M); // total 10 min
  assert(adapter.reshowCalls === 2, 'the 10-min snooze fired second');
  assert(controller.isSnoozed(b) === false, 'b cleared');
}

// (g) destroy() clears every pending timer (no leaked sources).
{
  const { scheduler, controller } = harness();
  controller.snooze(new FakeNotification(), 5);
  controller.snooze(new FakeNotification(), 10);
  controller.snooze(new FakeNotification(), 15);

  controller.destroy();

  assert(scheduler.pending === 0, 'no pending timers after destroy()');
}

// (h) snoozing an already-snoozed notification is a no-op.
{
  const { scheduler, adapter, controller } = harness();
  const n = new FakeNotification();
  controller.snooze(n, 5);
  controller.snooze(n, 10);

  assert(adapter.hideCalls === 1, 'hide called once (duplicate is a no-op)');
  assert(scheduler.pending === 1, 'one timer (duplicate is a no-op)');
}

// (i) isTransient is restored to its original value after a normal re-show.
{
  const { scheduler, controller } = harness();
  const n = new FakeNotification();
  n.isTransient = true;
  controller.snooze(n, 5);

  scheduler.advance(5 * M);

  assert(n.isTransient === true, 'isTransient restored after reshow');
}

// (j) isTransient is restored to its original value on cancel().
{
  const { controller } = harness();
  const n = new FakeNotification();
  n.isTransient = true;
  controller.snooze(n, 5);

  controller.cancel(n);

  assert(n.isTransient === true, 'isTransient restored on cancel');
}

// (k) a declined re-show (adapter returns false) restores acknowledged = true
//     so no stuck unread badge is left behind.
{
  const { scheduler, adapter, controller } = harness();
  adapter._showResult = false;
  const n = new FakeNotification();
  n.acknowledged = false; // simulate the adapter's requestReshow side effect
  controller.snooze(n, 5);

  scheduler.advance(5 * M);

  assert(adapter.reshowCalls === 1, 'reshow attempted once');
  assert(n.acknowledged === true, 'acknowledged restored on decline');
  assert(controller.isSnoozed(n) === false, 'snooze cleared on decline');
}

// (l) onReshow callback fires on successful re-show with the notification.
{
  let called = null;
  const { scheduler, controller } = harness((n) => { called = n; });
  const n = new FakeNotification();
  controller.snooze(n, 5);

  scheduler.advance(5 * M);

  assert(called === n, 'onReshow called with the notification');
  assert(controller.isSnoozed(n) === false, 'snooze cleared');
}

// (m) onReshow is NOT called when the re-show is declined (DND blocks it).
{
  let called = false;
  const { scheduler, adapter, controller } = harness(() => { called = true; });
  adapter._showResult = false;
  const n = new FakeNotification();
  controller.snooze(n, 5);

  scheduler.advance(5 * M);

  assert(called === false, 'onReshow not called when re-show declined');
}

// (n) onReshow is NOT called on cancel().
{
  let called = false;
  const { controller } = harness(() => { called = true; });
  const n = new FakeNotification();
  controller.snooze(n, 5);

  controller.cancel(n);

  assert(called === false, 'onReshow not called on cancel');
}

// (o) onReshow is NOT called when the notification is destroyed externally.
{
  let called = false;
  const { controller } = harness(() => { called = true; });
  const n = new FakeNotification();
  controller.snooze(n, 5);

  n.emitDestroy();

  assert(called === false, 'onReshow not called on external destroy');
}

// (p) two concurrent snoozes each trigger onReshow for their own notification.
{
  const calls = [];
  const { scheduler, controller } = harness((n) => { calls.push(n); });
  const a = new FakeNotification();
  const b = new FakeNotification();
  controller.snooze(a, 5);
  controller.snooze(b, 10);

  scheduler.advance(5 * M);
  assert(calls.length === 1, 'first onReshow fired');
  assert(calls[0] === a, 'first onReshow received notification a');

  scheduler.advance(5 * M);
  assert(calls.length === 2, 'second onReshow fired');
  assert(calls[1] === b, 'second onReshow received notification b');
}

console.log('snoozeController.test.js: PASS');
