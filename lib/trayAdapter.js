// SPDX-License-Identifier: GPL-2.0-or-later

// Shell-coupled glue that hides and re-shows notifications by driving GNOME
// Shell's own message-tray state machine, rather than hand-tearing-down private
// fields (which would skip _hideNotificationCompleted() and leak the
// compositor's unredirect balance). Every private field touched below carries a
// `mt:<line>` citation to the GNOME 50 source (js/ui/messageTray.js), per the
// extensions.gnome.org requirement that every internal access be explainable.

export class TrayAdapter {
  constructor(tray) {
    this._tray = tray;
  }

  // Hide the currently-shown banner WITHOUT destroying the notification, so it
  // can be re-shown later. No-op if `notification` is not the one showing.
  hideBannerKeepingNotification(notification) {
    const tray = this._tray;

    if (tray._notification !== notification)
      return;

    // _hideNotificationCompleted() destroys the notification when isTransient
    // is true (mt:1285); force false so it survives the snooze.
    notification.isTransient = false; // mt:1285

    // Cancel the pending auto-hide timeout (timeout 0 cancels) mt:1219-1223.
    tray._updateNotificationTimeout(0); // mt:1219

    // Force mustClose even for CRITICAL notifications, which otherwise never
    // auto-hide. _updateState() self-clears this flag (mt:1118).
    tray._notificationExpired = true; // mt:1099, self-clear mt:1118

    // Run the state machine: _hideNotification() -> _hideNotificationCompleted()
    // re-balances unredirect (mt:1290) and shows the next queued banner.
    tray._updateState(); // mt:1060
  }

  // Re-show the notification by flipping it back to "unacknowledged". This
  // synchronously triggers the source's notify::acknowledged handler, which
  // re-emits notification-request-banner and re-queues/shows it (mt:589-594,
  // mt:930-960). Returns true if the Shell accepted it (now showing, or queued
  // behind others); false if declined (DND policy gate mt:938, or full queue
  // mt:952).
  requestReshow(notification) {
    notification.acknowledged = false; // mt:589-594 (re-banner on !acknowledged)

    const tray = this._tray;
    return (
      tray._notification === notification ||
      tray._notificationQueue.includes(notification)
    );
  }
}
