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
const ByteArray = imports.byteArray;


const ZFSPoolStatus = GObject.registerClass(

  class ZFSPoolStatus extends St.BoxLayout {

    _init(pool_name) {
      super._init();
      this._pool_name = pool_name;

      const child_labels = new St.BoxLayout();

      child_labels.add_child(new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': '[',
        'style_class': 'zfs_pool_separator'
      }));

      this._pool_name_label = new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': this._pool_name,
        'style_class': 'zfs_pool_unavail'
      });
      child_labels.add_child(this._pool_name_label);

      child_labels.add_child(new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': ']',
        'style_class': 'zfs_pool_separator'
      }));

      this.add_child(child_labels);

      this.update_pool_status();

      return;
    }

    get_pool_name() {
      return this._pool_name;
    }

    get_pool_state() {
      try {
        let fileContents = GLib.file_get_contents('/proc/spl/kstat/zfs/' + this._pool_name + '/state');
        if (fileContents[0] === true) return ByteArray.toString(fileContents[1]);
      } catch (e) { }
      return 'UNAVAIL';
    }

    update_pool_status() {
      const current_pool_state = this.get_pool_state();
      if (current_pool_state != this._previous_pool_state) {
        this._pool_name_label.style_class = 'zfs_pool_' + current_pool_state.toLowerCase();
        this._previous_pool_state = current_pool_state;
      }
      return;
    }

  } // class ZFSPoolStatus

); // const ZFSPoolStatus


const ZFSStatusIndicator = GObject.registerClass(

  class ZFSStatusIndicator extends PanelMenu.Button {

    _init() {
      super._init(0.0, 'ZFS Status Monitor');

      this._pools = new St.BoxLayout();
      this.add_child(this._pools);

      return;
    }

    add_pool(pool_name) {
      const new_pool = new ZFSPoolStatus(pool_name);
      this._pools.add_child(new_pool); //TODO Keep these sorted by pool_name?
      return new_pool;
    }

    get_pool(pool_name) {
      for (const pool of this._pools.get_children()) {
        if (pool.get_pool_name() == pool_name) {
          return pool;
        }
      }
      return null;
    }

    remove_pool(pool_name) {
      const removed_pool = this.get_pool(pool_name);
      if (removed_pool) {
        this._pools.remove_child(removed_pool);
        removed_pool.destroy();
      }
      return removed_pool;
    }

  } // class ZFSStatusIndicator

); // const ZFSStatusIndicator


class ZFSStatusMonitorExtension {

  constructor(uuid) {
    this._uuid = uuid;
    return;
  }

  enable() {
    this._status_indicator = new ZFSStatusIndicator();
    this._previous_pool_names = [];
    this.update_pools();
    Main.panel.addToStatusArea(this._uuid, this._status_indicator);
    return;
  }

  get_pool_names() {
    return ['MyZFSPool'];
  }

  update_pools() {
    const current_pool_names = this.get_pool_names();

    // Remove pools that no longer exist.
    for (const previous_pool_name of this._previous_pool_names) {
      if (current_pool_names.indexOf(previous_pool_name) <= -1) {
        this._status_indicator.remove_pool(previous_pool_name);
      }
    }

    // Update any pools that did exist previously.
    for (const current_pool_name of current_pool_names) {
      if (this._previous_pool_names.indexOf(current_pool_name) >= 0) {
        this._status_indicator.get_pool(current_pool_name).update_pool_status();
      }
    }

    // Add any pools that didn't exist previously.
    for (const current_pool_name of current_pool_names) {
      if (this._previous_pool_names.indexOf(current_pool_name) <= -1) {
        this._status_indicator.add_pool(current_pool_name);
      }
    }

    this._previous_pool_names = current_pool_names;

    return;
  }

  disable() {
    this._status_indicator.destroy();
    this._status_indicator = null;
    this._previous_pool_names = [];
    return;
  }

} // class ZFSStatusMonitorExtension


function init(meta) {
  return new ZFSStatusMonitorExtension(meta.uuid);
}

