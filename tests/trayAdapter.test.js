// Copyright (C) 2026 Felipe Reyes
// SPDX-License-Identifier: GPL-2.0-or-later

// Unit tests for TrayAdapter (lib/trayAdapter.js) against a fake MessageTray.
// Deterministically locks the exact state-machine drive and the decline-aware
// re-show check without needing a live GNOME Shell.
import { TrayAdapter } from '../lib/trayAdapter.js';
import { FakeNotification } from './fakes.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

class FakeTray {
  constructor() {
    this._notification = null;
    this._notificationQueue = [];
    this._notificationExpired = false;
    this._timeoutCalls = [];
    this._stateCalls = 0;
  }

  _updateNotificationTimeout(timeout) {
    this._timeoutCalls.push(timeout);
  }

  _updateState() {
    this._stateCalls += 1;
  }
}

// hide: forces isTransient false, cancels timeout, marks expired, updates state.
{
  const tray = new FakeTray();
  const adapter = new TrayAdapter(tray);
  const n = new FakeNotification();
  n.isTransient = true;
  tray._notification = n;

  adapter.hideBannerKeepingNotification(n);

  assert(n.isTransient === false, 'isTransient forced false');
  assert(
    tray._timeoutCalls.length === 1 && tray._timeoutCalls[0] === 0,
    'timeout(0) called exactly once',
  );
  assert(tray._notificationExpired === true, '_notificationExpired set');
  assert(tray._stateCalls === 1, '_updateState called once');
}

// hide: no-op when the notification is not the one currently showing.
{
  const tray = new FakeTray();
  const adapter = new TrayAdapter(tray);
  const showing = new FakeNotification();
  const other = new FakeNotification();
  other.isTransient = true;
  tray._notification = showing;

  adapter.hideBannerKeepingNotification(other);

  assert(tray._stateCalls === 0, 'no state change when not showing');
  assert(other.isTransient === true, 'isTransient untouched when not showing');
}

// requestReshow: accepted when the notification is now showing.
{
  const tray = new FakeTray();
  const adapter = new TrayAdapter(tray);
  const n = new FakeNotification();
  n.acknowledged = true;
  tray._notification = n;

  const shown = adapter.requestReshow(n);

  assert(n.acknowledged === false, 'acknowledged set false');
  assert(shown === true, 'returns true when showing');
}

// requestReshow: accepted when the notification is queued.
{
  const tray = new FakeTray();
  const adapter = new TrayAdapter(tray);
  const n = new FakeNotification();
  n.acknowledged = true;
  tray._notification = null;
  tray._notificationQueue = [n];

  const shown = adapter.requestReshow(n);

  assert(n.acknowledged === false, 'acknowledged set false');
  assert(shown === true, 'returns true when queued');
}

// requestReshow: declined when neither showing nor queued.
{
  const tray = new FakeTray();
  const adapter = new TrayAdapter(tray);
  const n = new FakeNotification();
  n.acknowledged = true;
  tray._notification = null;
  tray._notificationQueue = [];

  const shown = adapter.requestReshow(n);

  assert(shown === false, 'returns false when declined');
}

console.log('trayAdapter.test.js: PASS');
