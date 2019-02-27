#!/bin/bash

git reset --hard;
git pull;
git submodule sync --recursive;
git submodule update --init --recursive;
npm i;
tsc;