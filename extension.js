/*
 * Copyright 2021-2021 by Chris Hubick. All Rights Reserved.
 * 
 * This work is licensed under the terms of the "GNU GENERAL PUBLIC LICENSE"
 * version 3 (or any later version), as published by the Free Software Foundation,
 * a copy of which you should have received in the file LICENSE.txt.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const { GObject, St, Clutter, Gio } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;


/* Display the status of an individual ZFS pool. */
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

      child_labels.add_child(new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': this._pool_name,
        'style_class': 'zfs_pool_name'
      }));

      child_labels.add_child(new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': '=',
        'style_class': 'zfs_pool_separator'
      }));

      this._pool_state_label = new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': 'UNAVAIL',
        'style_class': 'zfs_pool_state_unavail'
      });
      child_labels.add_child(this._pool_state_label);

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

    /* Retrieve the current state of the ZFS pool monitored by this object from '/proc/spl/kstat/zfs/'. */
    get_pool_state() {
      try {
        let fileContents = GLib.file_get_contents('/proc/spl/kstat/zfs/' + this._pool_name + '/state');
        if (fileContents[0] === true) return ByteArray.toString(fileContents[1]).trim();
      } catch (e) { }
      return 'UNAVAIL';
    }

    /* Retrieve the current state of the ZFS pool monitored by this object and update the UI with it. */
    update_pool_status() {
      const current_pool_state = this.get_pool_state();
      if (current_pool_state != this._previous_pool_state) {
        this._pool_state_label.set_text(current_pool_state);
        this._pool_state_label.set_style_class_name('zfs_pool_state_' + current_pool_state.toLowerCase());
        this._previous_pool_state = current_pool_state;
      }
      return;
    }

  } // class ZFSPoolStatus

); // const ZFSPoolStatus


/* A container of 'ZFSPoolStatus' elements that will be added to the Gnome panel by this extension. */
const ZFSStatusIndicator = GObject.registerClass(

  class ZFSStatusIndicator extends PanelMenu.Button {

    _init() {
      super._init(0.0, 'ZFS Status Monitor');

      this._pools = new St.BoxLayout();
      this.add_child(this._pools);

      return;
    }

    /* Create a new 'ZFSPoolStatus' object with the suplied pool name and add it to those displayed by this indicator. */
    add_pool(pool_name) {
      const new_pool = new ZFSPoolStatus(pool_name);
      this._pools.add_child(new_pool); //TODO Keep these sorted by pool_name?
      return new_pool;
    }

    /* Retrieve the 'ZFSPoolStatus' object with the suplied pool name from those displayed by this indicator. */
    get_pool(pool_name) {
      for (const pool of this._pools.get_children()) {
        if (pool.get_pool_name() == pool_name) {
          return pool;
        }
      }
      return null;
    }

    /* Destroy the 'ZFSPoolStatus' object with the suplied pool name, removing it from those displayed by this indicator. */
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


/* The primary class implementing this extension. */
class ZFSStatusMonitorExtension {

  constructor(uuid) {
    this._uuid = uuid;
    return;
  }

  /* Called by Gnome to enable this extension. */
  enable() {
    this._status_indicator = new ZFSStatusIndicator();
    this._previous_pool_names = [];
    this.update_pools();
    Main.panel.addToStatusArea(this._uuid, this._status_indicator);
    this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, 60, this.update_pools.bind(this)); // Tell GLib to invoke update_pools() every 60 seconds.
    return;
  }

  /* Return an array containing the names of the ZFS pools present on this system, as identified by '/proc/spl/kstat/zfs/.../status' files. */
  get_pool_names() {
    const pool_names = [];
    const proc_zfs_folder = Gio.File.new_for_path('/proc/spl/kstat/zfs/');
    if ((proc_zfs_folder.query_exists(null)) && (proc_zfs_folder.query_file_type(Gio.FileQueryInfoFlags.NONE, null) == Gio.FileType.DIRECTORY)) {
      const zfs_folder_child_enumerator = proc_zfs_folder.enumerate_children(Gio.FILE_ATTRIBUTE_STANDARD_NAME + ',' + Gio.FILE_ATTRIBUTE_STANDARD_TYPE, Gio.FileQueryInfoFlags.NONE, null);
      let zfs_folder_child_info;
      while (zfs_folder_child_info = zfs_folder_child_enumerator.next_file(null)) {
        if (zfs_folder_child_info.get_file_type() != Gio.FileType.DIRECTORY) continue;
        const zfs_folder_child_dir = zfs_folder_child_enumerator.get_child(zfs_folder_child_info);
        if (!zfs_folder_child_dir.get_child('state').query_exists(null)) continue; // If there's no 'state' file, assume this folder doesn't represent a pool.
        pool_names.push(zfs_folder_child_dir.get_basename());
      }
    }
    return pool_names;
  }

  /* Update the UI with the current list of ZFS pools on this system and their status. */
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

    return GLib.SOURCE_CONTINUE;
  }

  /* Called by Gnome to disable this extension. */
  disable() {
    if (this._timeout != null) {
      GLib.source_remove(this._timeout);
      this._timeout = null;
    }
    if (this._status_indicator != null) {
      this._status_indicator.destroy();
      this._status_indicator = null;
    }
    this._previous_pool_names = [];
    return;
  }

} // class ZFSStatusMonitorExtension


function init(meta) {
  return new ZFSStatusMonitorExtension(meta.uuid);
}

