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


const Indicator = GObject.registerClass(

  class Indicator extends PanelMenu.Button {

    _init() {
      super._init(0.0, 'ZFS Status Monitor');

      this._label = new St.Label({
        'y_align': Clutter.ActorAlign.CENTER,
        'text': 'MyZFSPool',
        'style_class': 'label'
      });
      this.add_child(this._label);

    }

  } // class Indicator

); // const Indicator


class Extension {

  constructor(uuid) {
    this._uuid = uuid;
  }

  enable() {
    this._indicator = new Indicator();
    Main.panel.addToStatusArea(this._uuid, this._indicator);
  }

  disable() {
    this._indicator.destroy();
    this._indicator = null;
  }

} // class Extension


function init(meta) {
  return new Extension(meta.uuid);
}

