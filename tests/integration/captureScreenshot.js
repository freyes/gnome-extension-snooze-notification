// Copyright (C) 2026 Felipe Reyes
// SPDX-License-Identifier: GPL-2.0-or-later

// Captures a screenshot of the extension in action (banner + Snooze button)
// from a headless nested shell. Run with:
//   dbus-run-session -- gnome-shell-test-tool --headless \
//     --extension <zip> tests/integration/captureScreenshot.js
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';
// Importing screenshot.js promisifies Shell.Screenshot methods (screenshot.js:19-24).
import 'resource:///org/gnome/shell/ui/screenshot.js';

const OUT = '/tmp/opencode/snooze-screenshot.png';

export function init() {}

export async function run() {
  const source = new MessageTray.Source({
    title: 'Example App',
    iconName: 'dialog-information-symbolic',
  });
  Main.messageTray.add(source);

  const notification = new MessageTray.Notification({
    source,
    title: 'New message',
    body: 'You have a new message. Click Snooze to be reminded later.',
  });
  source.addNotification(notification);

  for (let i = 0; i < 50 && !Main.messageTray._banner; i++)
    await Scripting.sleep(100);

  await Scripting.sleep(800); // let the slide-in animation settle

  const shooter = new Shell.Screenshot();
  const [content] = await shooter.screenshot_stage_to_content();
  if (!content) throw new Error('stage content capture failed');

  const texture = content.get_texture();
  const stream = Gio.MemoryOutputStream.new_resizable();
  const pixbuf = await Shell.Screenshot.composite_to_stream(
    texture,
    0,
    0,
    global.screen_width,
    global.screen_height,
    1,
    null,
    0,
    0,
    1,
    stream,
  );
  stream.close(null);

  const ok = pixbuf.savev(OUT, 'png', [], []);
  if (!ok) throw new Error('failed to save screenshot');

  console.log(`SCREENSHOT: ${OUT}`);
}

export function finish() {}
