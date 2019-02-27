import { Config } from "./lib/models/Config";
import { ConfigLoader } from "./lib/tools/ConfigLoader";
import { resolve } from "path";

export interface BaseConfig extends Config {
	map: {
		root: string,		// root path of destination images
		id: string			// The Map ID (folder-name) e.g.:  0-0-0-0-4255_-1110502957_Vergessenes\ Land-1339424556
	},
	websocket: {			// WebSocket settings
		host: string,
		port: number,
		uplink: string		// connectionstring to RisingMapsBackend
	}
}

var C = ConfigLoader.getInstance<BaseConfig>(resolve(__dirname, "..", "config"));

export var cfg: BaseConfig = C.cfg;