const R = 6378137; // WGS84 지구 반지름 (미터)
const TILE_SIZE = 50; // 타일 크기 (미터)

function lngLatToMercator(lng: number, lat: number): { x: number; y: number } {
  const x = lng * (Math.PI / 180) * R;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R;
  return { x, y };
}

function mercatorToLngLat(x: number, y: number): { lng: number; lat: number } {
  const lng = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return { lng, lat };
}

export function getTileInfo(lng: number, lat: number): {
  tileId: string;
  centerLat: number;
  centerLng: number;
} {
  const { x, y } = lngLatToMercator(lng, lat);
  const gx = Math.floor(x / TILE_SIZE);
  const gy = Math.floor(y / TILE_SIZE);
  const tileId = `${gx}_${gy}`;
  const { lng: centerLng, lat: centerLat } = mercatorToLngLat(
    (gx + 0.5) * TILE_SIZE,
    (gy + 0.5) * TILE_SIZE,
  );
  return { tileId, centerLat, centerLng };
}
