/*
 * Copyright 2021-2021 by Chris Hubick. All Rights Reserved.
 * 
 * This work is licensed under the terms of the "GNU GENERAL PUBLIC LICENSE"
 * version 3, as published by the Free Software Foundation, a copy of which
 * you should have received in the file LICENSE.txt.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */

const { GObject, St, Clutter } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const GLib = imports.gi.GLib;


const ZFSPoolStatusIndicator = GObject.registerClass(

  class ZFSPoolStatusIndicator extends PanelMenu.Button {

    _init(zfs_pool_name) {
      super._init(0.0, 'ZFS Pool ' + zfs_pool_name + ' Status Indicator');
      this._zfs_pool_name = zfs_pool_name;

      const child_labels = new St.BoxLayout();

      child_labels.add_child(new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': '[',
        'style_class': 'zfs_pool_separator'
      }));

      this._pool_name_label = new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': zfs_pool_name,
        'style_class': 'zfs_pool_unavail'
      });
      child_labels.add_child(this._pool_name_label);

      child_labels.add_child(new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': ']',
        'style_class': 'zfs_pool_separator'
      }));

      this.add_child(child_labels);

      this.update();

      return;
    }

    get_pool_state() {
      try {
        let fileContents = GLib.file_get_contents('/proc/spl/kstat/zfs/' + this._zfs_pool_name + '/state');
        if (fileContents[0] === true) return String(fileContents[1]);
      } catch (e) { }
      return 'UNAVAIL';
    }

    update() {
      this._pool_name_label.style_class = 'zfs_pool_' + this.get_pool_state().toLowerCase();
      return;
    }

  } // class ZFSPoolStatusIndicator

); // const ZFSPoolStatusIndicator


class ZFSStatusMonitorExtension {

  constructor(uuid) {
    this._uuid = uuid;
    return;
  }

  enable() {
    this._zfs_pool_status_indicator = new ZFSPoolStatusIndicator('MyZFSPool');
    Main.panel.addToStatusArea(this._uuid, this._zfs_pool_status_indicator);
    return;
  }

  disable() {
    this._zfs_pool_status_indicator.destroy();
    this._zfs_pool_status_indicator = null;
    return;
  }

} // class ZFSStatusMonitorExtension


function init(meta) {
  return new ZFSStatusMonitorExtension(meta.uuid);
}

