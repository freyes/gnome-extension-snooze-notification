// Copyright (C) 2026 Felipe Reyes
// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';

import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SnoozeNotificationPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: _('General'),
      icon_name: 'preferences-system-notifications-symbolic',
    });
    window.add(page);

    const group = new Adw.PreferencesGroup({
      title: _('Snooze'),
      description: _('Configure the snooze delay for notifications.'),
    });
    page.add(group);

    const spinRow = new Adw.SpinRow({
      title: _('Snooze delay (minutes)'),
      subtitle: _('How long to wait before re-showing a snoozed notification.'),
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 120,
        step_increment: 1,
        page_increment: 10,
      }),
    });
    group.add(spinRow);

    window._settings.bind(
      'snooze-minutes',
      spinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    );
  }
}
