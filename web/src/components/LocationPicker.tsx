import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";

export const GANDHINAGAR: [number, number] = [23.2156, 72.6369];

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Small map: tap to set the asset's position. CircleMarker avoids Leaflet's image icons. */
export default function LocationPicker({ lat, lng, onPick }: { lat?: number; lng?: number; onPick: (lat: number, lng: number) => void }) {
  const has = lat !== undefined && lng !== undefined;
  return (
    <MapContainer center={has ? [lat, lng] : GANDHINAGAR} zoom={has ? 16 : 13} className="h-72 w-full rounded-xl ring-1 ring-gray-300" scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToPlace onPick={onPick} />
      {has && <CircleMarker center={[lat, lng]} radius={10} pathOptions={{ color: "#1e3a8a", fillColor: "#2563eb", fillOpacity: 0.9 }} />}
    </MapContainer>
  );
}
