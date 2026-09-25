// Copyright (C) 2026 Felipe Reyes
// SPDX-License-Identifier: GPL-2.0-or-later

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

// Adds a "Snooze" button to a notification banner. The button is appended to
// the banner's top-level vertical box (get_first_child() is the vbox that
// Message.set_child() installed, messageList.js:488), right-aligned under the
// banner text. Feature-detected: if the banner exposes no such box, this is a
// no-op so a future shell that changes the banner layout degrades gracefully.
export class SnoozeButton {
  constructor(banner, notification, controller, getMinutes) {
    this._banner = banner;
    this._notification = notification;
    this._controller = controller;
    this._getMinutes = getMinutes;

    const column = banner.get_first_child();
    if (!column)
      return;

    this._button = new St.Button({
      style_class: 'notification-snooze-button',
      label: _('Snooze'),
      can_focus: true,
      x_align: Clutter.ActorAlign.END,
    });
    this._button.accessible_name = _('Snooze notification');

    this._button.connect('clicked', () => {
      const minutes = this._getMinutes();
      this._controller.snooze(this._notification, minutes);
    });

    column.add_child(this._button);

    // Foreign object: key the destroy handler on `this` so destroy() drops it
    // with one disconnectObject(this), matching the mute-banners-timer
    // convention.
    banner.connectObject('destroy', () => this.destroy(), this);
  }

  destroy() {
    this._banner?.disconnectObject(this);
    this._button?.destroy();
    this._button = null;
    this._banner = null;
    this._notification = null;
    this._controller = null;
    this._getMinutes = null;
  }
}
