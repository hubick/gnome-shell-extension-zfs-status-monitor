#!/bin/sh
version=$(jq .version metadata.json) || exit 1
zip -9 "zfs-status-monitor@chris.hubick.com_v$version.zip" metadata.json extension.js stylesheet.css

