import * as WebSocket from "ws";
import { cfg as config, BaseConfig } from "./config";
import { LOGTAG } from "./lib/models/Config";
import { createHash } from "crypto";
import { MapTileInfo } from "./models/MapTileInfo";
import { fstat, writeFileSync, readFileSync, accessSync } from "fs";
import { resolve } from "path";

export class FakeAPIServer {
	protected static highlander: FakeAPIServer = null;
	public static getInstance(): FakeAPIServer {
		if (!FakeAPIServer.highlander) {
			FakeAPIServer.highlander = new FakeAPIServer();
		}
		return FakeAPIServer.highlander;
	}

	protected timer: NodeJS.Timer = null;

	private get cfg(): BaseConfig {
		return config;
	}

	private get mapId(): string {
		const idHash = createHash("sha256");
		idHash.update(this.cfg.map.id);
		return idHash.digest('hex');
	}

	private get mapInfoFilePath(): string {
		return resolve(__dirname, '..', 'mti.json');
	}

	private wsServer: WebSocket.Server = null;
	private wsClient: WebSocket = null;
	private wsReconnectTimer: NodeJS.Timer = null;

	private mapTileInfoMap: Map<string, MapTileInfo> = new Map<string, MapTileInfo>();
	private mapTileCacheMap: Map<string, MapTileInfo> = new Map<string, MapTileInfo>();

	private constructor() {
		this.loadMTIFile();
		this.initWSServer();
		this.initWSClient();

		this.timer = setTimeout(() => {
			this.autoSaveMTI();
		}, 5000);
	}

	protected autoSaveMTI(): void {
		this.saveMTIFile();
		this.timer.refresh();
	}

	protected initWSServer() {
		!this.cfg.log.info ? null : console.log(LOGTAG.INFO, "[initWSServer]", `Starting WebSocket Server @${this.cfg.websocket.host}:${this.cfg.websocket.port}`);
		this.wsServer = new WebSocket.Server({ host: this.cfg.websocket.host, port: this.cfg.websocket.port });
		this.wsServer.on('connection', (ws, request) => {
			!this.cfg.log.info ? null : console.log(LOGTAG.INFO, "[connection]", `Client connected from ${request.connection.remoteAddress}`);
			ws.on('message', (data) => {
				// !this.cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[onMessage]", `Message of type ${typeof data} received`);
				if (typeof data == "string") {
					const msg = JSON.parse(data);
					switch (msg.type) {
						case "auth":
							!this.cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[onMessage:auth]", `authhash=${msg.hash}, mapId: ${this.mapId}`);
							ws.send(JSON.stringify({ type: "auth", ok: msg.hash === this.mapId }));
							break;
						case "map.tile.info":
							if (this.mapTileInfoMap.has(msg.data.fileName)) {
								const mti: MapTileInfo = this.mapTileInfoMap.get(msg.data.fileName);
								if (new Date(mti.lastModifiedOn).getTime() > new Date(msg.data.lastModifiedOn).getTime()) {
									ws.send(JSON.stringify({ type: "maptileresponse", ok: false, hash: msg.data.hash }));
									return;
								}
							}
							this.mapTileInfoMap.set(msg.data.fileName, msg.data);
							this.mapTileCacheMap.set(msg.data.hash, msg.data);
							ws.send(JSON.stringify({ type: "maptileresponse", ok: true, hash: msg.data.hash }));

							break;
						default:
							!this.cfg.log.warn ? null : console.log(LOGTAG.WARN, "[onMessage]", `Unknown message type <${msg.type}>`);
							break;
					}
				} else if (typeof data == "object") {
					const msg: Buffer = <Buffer>data;
					const mapHash = createHash("sha256").update(msg).digest("hex");
					// const mti = (Array.from(this.mapTileInfoMap).find((v) => v[1].hash == mapHash) || [null])[1];
					const mti = this.mapTileCacheMap.get(mapHash);
					if (!mti) {
						!this.cfg.log.warn ? null : console.log(LOGTAG.WARN, "[initWSServer]", `Map-Hash not found <${mapHash}>`);
						return; // ignore
					}
					const coordBuffer: Buffer = Buffer.alloc(4);
					coordBuffer.writeInt16BE(mti.coords.x, 0);
					coordBuffer.writeInt16BE(mti.coords.y, 2);
					const mapBuffer: Buffer = Buffer.concat([coordBuffer, msg]);
					this.wsClient.send(mapBuffer);
					this.mapTileCacheMap.delete(mapHash);
				}
			});
			ws.on("close", (code, reason) => {
				!this.cfg.log.info ? null : console.log(LOGTAG.INFO, "[connection]", `Client ${request.connection.remoteAddress} disconnected with code ${code} and reason ${reason}`);
			})
		});
	}

	/**
	 * Connection to RisingMapsBackend
	 *
	 * @protected
	 * @memberof FakeAPIServer
	 */
	protected initWSClient() {
		!this.cfg.log.info ? null : console.log(LOGTAG.INFO, "[wsc:open]", `Connecting to RisinMap Backend on ${this.cfg.websocket.uplink}`);

		this.wsClient = new WebSocket(this.cfg.websocket.uplink);
		this.wsClient.on('open', () => {
			!this.cfg.log.info ? null : console.log(LOGTAG.INFO, "[wsc:open]", `Connected to RisinMap Backend`);
		});

		this.wsClient.on('error', () => {
			if (!this.wsReconnectTimer) {
				this.wsReconnectTimer = setTimeout(() => {
					this.initWSClient();
				}, 5000);
			}
			this.wsReconnectTimer.refresh();
		});

		this.wsClient.on('close', () => {
			!this.cfg.log.info ? null : console.log(LOGTAG.INFO, "[wsc:close]", `Connection to RisinMap Backend closed, reconnect in 5 seconds`);
			if (!this.wsReconnectTimer) {
				this.wsReconnectTimer = setTimeout(() => {
					this.initWSClient();
				}, 5000);
			}
			this.wsReconnectTimer.refresh();
		});
	}

	protected loadMTIFile(): void {
		try {
			accessSync(this.mapInfoFilePath);
			const mti = JSON.parse(readFileSync(this.mapInfoFilePath).toString('UTF8'));
			this.mapTileInfoMap = new Map(mti);
		} catch (error) {
			!this.cfg.log.info ? null : console.log(LOGTAG.INFO, "[loadMTIFile]", `No MTI file found`);
		}
	}

	protected saveMTIFile(): void {
		writeFileSync(this.mapInfoFilePath, JSON.stringify([...this.mapTileInfoMap]));
	}

	protected destroy(): void {
		this.saveMTIFile();
	}
}