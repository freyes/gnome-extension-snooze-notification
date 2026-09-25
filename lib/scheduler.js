// SPDX-License-Identifier: GPL-2.0-or-later

// Wall-clock scheduler used at runtime. The SnoozeController consumes the same
// `{ schedule(seconds, cb), cancel(handle) }` interface, which tests replace
// with a FakeScheduler for deterministic, instant expiry.
import GLib from 'gi://GLib';

export class GLibScheduler {
  schedule(seconds, callback) {
    return GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
      callback();
      return GLib.SOURCE_REMOVE;
    });
  }

  cancel(handle) {
    if (handle) GLib.source_remove(handle);
  }
}
