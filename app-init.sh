#!/bin/bash

LOGDIR="/var/logs";
ROOTDIR="$(dirname "$0")";
NAME="rw-fakeapi-server";
cd $ROOTDIR;

cp -R "$ROOTDIR/app.service" "/usr/lib/systemd/system/$NAME.service";
cp -R "$ROOTDIR/app.conf" "/etc/rsyslog.d/$NAME.conf";
systemctl restart rsyslog.service;

systemctl enable $NAME.service
systemctl start $NAME.service