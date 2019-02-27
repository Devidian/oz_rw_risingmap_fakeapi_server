export interface MapTileInfo {
    mapId: string,
    fileName: string,
    coords: {
        x: number,
        y: number
    },
    hash: string,
    lastModifiedOn: Date
}