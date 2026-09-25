// Copyright (C) 2026 Felipe Reyes
// SPDX-License-Identifier: GPL-2.0-or-later

// Test doubles for the SnoozeController unit tests.
// Plain JavaScript only — no gi:// or resource:// imports, so this module runs
// headless under `gjs -m` with no GNOME Shell platform present.

// A deterministic scheduler that records scheduled jobs and lets the test
// advance a virtual clock. Mirrors the interface the controller consumes from
// lib/scheduler.js (GLibScheduler) so the controller can be tested without
// wall-clock time.
export class FakeScheduler {
  constructor() {
    this._jobs = []; // { handle, seconds, callback, cancelled }
    this._nextHandle = 1;
    this._now = 0;
  }

  schedule(seconds, callback) {
    const handle = this._nextHandle++;
    this._jobs.push({ handle, seconds, callback, cancelled: false });
    return handle;
  }

  cancel(handle) {
    const job = this._jobs.find((j) => j.handle === handle);
    if (job) job.cancelled = true;
  }

  advance(seconds) {
    this._now += seconds;
    const due = this._jobs
      .filter((j) => !j.cancelled && j.seconds <= this._now)
      .sort((a, b) => a.handle - b.handle);
    for (const job of due) {
      job.cancelled = true; // one-shot, like GLib.SOURCE_REMOVE
      job.callback();
    }
  }

  // Number of jobs not yet fired or cancelled.
  get pending() {
    return this._jobs.filter((j) => !j.cancelled).length;
  }
}

// Records hide/reshow calls so tests can assert the controller drives the
// tray adapter exactly once per snooze.
export class FakeTrayAdapter {
  constructor() {
    this.hideCalls = 0;
    this.reshowCalls = 0;
    this._showResult = true; // script the requestReshow return value
    this._lastHidden = null;
    this._lastReshown = null;
  }

  hideBannerKeepingNotification(notification) {
    this.hideCalls += 1;
    this._lastHidden = notification;
  }

  requestReshow(notification) {
    this.reshowCalls += 1;
    this._lastReshown = notification;
    return this._showResult;
  }
}

// A minimal stand-in for MessageTray.Notification. Only the fields the
// controller reads/writes are modelled.
export class FakeNotification {
  constructor() {
    this.acknowledged = true;
    this.isTransient = false;
    this.urgency = 1;
    this.destroyed = false;
    this._destroyListeners = [];
  }

  // Simulate the GObject 'destroy' signal surface the controller hooks via
  // connectObject. The controller calls disconnectObject(this); here we expose
  // a matching minimal API so the pure controller works with a fake too.
  connectObject(signal, callback, owner) {
    if (signal === 'destroy') this._destroyListeners.push({ callback, owner });
    return this._destroyListeners.length - 1;
  }

  disconnectObject(owner) {
    this._destroyListeners = this._destroyListeners.filter(
      (l) => l.owner !== owner,
    );
  }

  emitDestroy() {
    this.destroyed = true;
    for (const { callback } of [...this._destroyListeners]) callback();
    this._destroyListeners = [];
  }
}
