// Copyright (C) 2026 Felipe Reyes
// SPDX-License-Identifier: GPL-2.0-or-later

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { SnoozeController } from './lib/snoozeController.js';
import { GLibScheduler } from './lib/scheduler.js';
import { TrayAdapter } from './lib/trayAdapter.js';
import { SnoozeButton } from './lib/snoozeButton.js';

export default class SnoozeNotificationExtension extends Extension {
  enable() {
    this._settings = this.getSettings();

    this._controller = new SnoozeController({
      trayAdapter: new TrayAdapter(Main.messageTray),
      scheduler: new GLibScheduler(),
    });

    this._snoozeButtons = [];

    // Inject a Snooze button into every new banner. The `child-added` signal
    // fires during MessageTray._showNotification()'s _bannerBin.add_child()
    // (messageTray.js:1143), i.e. before the banner's y-offset is computed
    // (messageTray.js:1146) — so the injected button does not glitch the slide-in.
    this._bannerChildId = Main.messageTray._bannerBin.connect( // mt:745 (_bannerBin)
      'child-added',
      (_bin, child) => {
        if (child.notification && !child.notification.resident)
          this._addSnoozeButton(child, child.notification);
      },
    );
  }

  _addSnoozeButton(banner, notification) {
    const button = new SnoozeButton(
      banner,
      notification,
      this._controller,
      () => this._settings.get_int('snooze-minutes'),
    );
    this._snoozeButtons.push(button);
  }

  disable() {
    if (this._bannerChildId) {
      Main.messageTray._bannerBin.disconnect(this._bannerChildId);
      this._bannerChildId = 0;
    }

    for (const button of this._snoozeButtons)
      button.destroy();
    this._snoozeButtons = [];

    // Cancel pending snoozes and restore each notification (isTransient +
    // acknowledged=false) so it re-banners on unlock instead of being
    // silently swallowed.
    this._controller?.destroy();
    this._controller = null;

    this._settings = null;
  }
}
