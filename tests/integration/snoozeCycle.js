// Integration automation script for gnome-shell-test-tool. Runs inside a
// nested GNOME Shell with the Snooze Notification extension installed+enabled
// via `--extension`. Verifies the real banner-injection and snooze-hide path.
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`INTEGRATION FAIL: ${msg}`);
}

function findSnoozeButton(banner) {
  const vbox = banner?.get_first_child();
  if (!vbox) return null;
  const children = vbox.get_children();
  return (
    children.find(
      (c) => c instanceof St.Button && c.style_class === 'notification-snooze-button',
    ) ?? null
  );
}

export function init() {}

export async function run() {
  // A non-resident, non-transient notification (snoozable).
  const source = new MessageTray.Source({
    title: 'Snooze test',
    iconName: 'dialog-information-symbolic',
  });
  Main.messageTray.add(source);

  let destroyed = false;
  const notification = new MessageTray.Notification({
    source,
    title: 'Integration test',
    body: 'This notification should get a Snooze button.',
  });
  notification.connect('destroy', () => {
    destroyed = true;
  });
  source.addNotification(notification);

  // Wait for the banner to appear.
  let banner = null;
  for (let i = 0; i < 50 && !banner; i++) {
    await Scripting.sleep(100);
    banner = Main.messageTray._banner;
  }
  assert(banner !== null, 'banner appeared for the notification');
  assert(banner.notification === notification, 'banner belongs to our notification');

  const button = findSnoozeButton(banner);
  assert(button !== null, 'Snooze button present on the banner');
  assert(button.accessible_name === 'Snooze notification', 'button has accessible name');

  // Click the snooze button (StButton 'clicked' passes the button itself).
  button.emit('clicked', button);

  // Wait for the (animated) hide to complete.
  for (let i = 0; i < 50 && Main.messageTray._banner !== null; i++)
    await Scripting.sleep(100);

  assert(Main.messageTray._banner === null, 'banner hidden after snooze');
  assert(!destroyed, 'notification survived the snooze (not destroyed)');
  assert(
    notification.acknowledged === true,
    'notification still acknowledged while snoozed',
  );

  console.log('INTEGRATION: snooze hide cycle OK');
}

export function finish() {}
