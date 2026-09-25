// SPDX-License-Identifier: GPL-2.0-or-later

// Pure scheduling logic for snoozing notifications. This module imports no
// GObject-introspection (gi) or Shell resource modules (verified by a purity
// guard in CI) so it can be unit-tested deterministically under plain `gjs -m`
// with injected fakes.
//
// Responsibilities:
//  - track pending snoozes (notification -> { timer handle, originalTransient })
//  - force a snoozed notification to survive its banner hide (isTransient=false)
//  - re-show it after the configured delay via the injected TrayAdapter
//  - cancel/restore cleanly on explicit cancel, external destroy, or destroy()

export class SnoozeController {
  // trayAdapter: { hideBannerKeepingNotification(n), requestReshow(n) -> bool }
  // scheduler:   { schedule(seconds, cb) -> handle, cancel(handle) }
  constructor({ trayAdapter, scheduler }) {
    this._adapter = trayAdapter;
    this._scheduler = scheduler;
    this._snoozed = new Map(); // notification -> { handle, originalTransient }
  }

  // Snooze `notification` for `minutes` minutes. Idempotent: snoozing a
  // notification that is already snoozed is a no-op.
  snooze(notification, minutes) {
    if (this._snoozed.has(notification)) return;

    // Transient notifications auto-destroy when their banner hides; force it
    // to survive until we re-show it. Original value is restored on reshow /
    // cancel / destroy.
    const originalTransient = notification.isTransient;
    notification.isTransient = false;

    this._adapter.hideBannerKeepingNotification(notification);

    // If the notification is destroyed externally (source removed, app quit),
    // drop the pending snooze rather than firing on a dead object.
    notification.connectObject(
      'destroy',
      () => this._onNotificationDestroyed(notification),
      this,
    );

    const handle = this._scheduler.schedule(minutes * 60, () =>
      this._reshow(notification),
    );

    this._snoozed.set(notification, { handle, originalTransient });
  }

  isSnoozed(notification) {
    return this._snoozed.has(notification);
  }

  // Undo a snooze: cancel the timer, restore the notification's transient
  // flag, and mark it unacknowledged so the Shell re-banners it.
  cancel(notification) {
    const entry = this._snoozed.get(notification);
    if (!entry) return;

    this._scheduler.cancel(entry.handle);
    notification.isTransient = entry.originalTransient;
    notification.acknowledged = false;
    notification.disconnectObject(this);
    this._snoozed.delete(notification);
  }

  // Cancel every pending snooze. Used on extension disable / screen lock so
  // notifications are not left silently swallowed.
  destroy() {
    for (const notification of [...this._snoozed.keys()]) {
      this.cancel(notification);
    }
  }

  _reshow(notification) {
    const entry = this._snoozed.get(notification);
    if (!entry) return;

    // Restore the transient flag before re-showing so the notification behaves
    // normally on its next (real) hide.
    notification.isTransient = entry.originalTransient;

    const shown = this._adapter.requestReshow(notification);

    // If the Shell declined the re-show (e.g. Do Not Disturb is active), leave
    // the notification acknowledged so it does not create a stuck unread badge.
    if (!shown) notification.acknowledged = true;

    notification.disconnectObject(this);
    this._snoozed.delete(notification);
  }

  _onNotificationDestroyed(notification) {
    const entry = this._snoozed.get(notification);
    if (!entry) return;
    this._scheduler.cancel(entry.handle);
    this._snoozed.delete(notification);
  }
}
