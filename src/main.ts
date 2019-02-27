'use strict';

import { cfg } from "./config";
import { LOGTAG } from "./lib/models/Config";
import { FakeAPIServer } from "./FakeAPIServer";

process.title = cfg.app.title;

!cfg.log.info ? null : console.log(LOGTAG.INFO, "[main]", "Starting");

const FAC: FakeAPIServer = FakeAPIServer.getInstance();