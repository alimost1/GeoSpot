
'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Tooltip } from 'react-leaflet';
import L, { type LatLngExpression, type LatLngTuple, type Map } from 'leaflet';
import { User, Landmark as LandmarkType } from '@/types'; // Assuming types are defined here
import { Landmark, User as UserIcon } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';

// Custom User Icon
const userIconSvg = ReactDOMServer.renderToString(<UserIcon size={24} color="#4db6ac" />); // Teal color
const userIcon = L.divIcon({
  html: userIconSvg,
  className: 'bg-transparent border-none',
  iconSize: [24, 24],
  iconAnchor: [12, 24], // Point of the icon which will correspond to marker's location
  popupAnchor: [0, -24] // Point from which the popup should open relative to the iconAnchor
});

// Custom Landmark Icon
const landmarkIconSvg = ReactDOMServer.renderToString(<Landmark size={24} color="#f59e0b" />); // Amber color
const landmarkIcon = L.divIcon({
  html: landmarkIconSvg,
  className: 'bg-transparent border-none',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
});

interface MapDisplayProps {
  center: LatLngExpression;
  users: User[];
  landmarks: LandmarkType[];
  onMove: (center: LatLngExpression) => void;
  onMarkerClick: (item: User | LandmarkType) => void;
  selectedUser: User | null;
  selectedLandmark: LandmarkType | null;
  landmarkSummaries: Record<string, string>; // Add this prop
}

const MapEvents = ({ onMove, mapRef }: { onMove: (center: LatLngExpression) => void, mapRef: React.RefObject<Map | null> }) => {
  const map = useMapEvents({
    moveend: () => {
      onMove(map.getCenter());
    },
  });
  if (mapRef) {
     // @ts-ignore Types might mismatch slightly, but it works
    mapRef.current = map;
  }
  return null;
};

const MapDisplay: React.FC<MapDisplayProps> = ({
  center,
  users,
  landmarks,
  onMove,
  onMarkerClick,
  selectedUser,
  selectedLandmark,
  landmarkSummaries,
}) => {
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center);
    }
  }, [center]); // Re-center map when center prop changes


  // Determine the marker to focus on
  const focusedItem = selectedUser || selectedLandmark;
  useEffect(() => {
    if (focusedItem && mapRef.current) {
      let targetLatLng: LatLngExpression | null = null;

      if (selectedUser) {
        targetLatLng = selectedUser.location;
      } else if (selectedLandmark) {
        // We need coordinates for landmarks. Assuming they are not available in the LandmarkType for now.
        // If landmarks had coordinates, you'd use them here:
        // targetLatLng = [selectedLandmark.lat, selectedLandmark.lng];
        // For now, we can't automatically fly to a landmark without coordinates.
      }

      if (targetLatLng) {
        mapRef.current.flyTo(targetLatLng, mapRef.current.getZoom()); // Fly to the location
      }
    }
  }, [selectedUser, selectedLandmark]);


  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} ref={mapRef}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapEvents onMove={onMove} mapRef={mapRef} />

      {/* User Markers */}
      {users.map((user) => (
        <Marker
          key={user.id}
          position={user.location}
          icon={userIcon}
          eventHandlers={{
            click: () => onMarkerClick(user),
          }}
        >
          <Tooltip direction="top" offset={[0, -20]}>
            {user.name}
          </Tooltip>
          {/* Optional: Add Popup for more details if needed later
           <Popup>
             <div>
               <h3>{user.name}</h3>
               <p>Some details about the user.</p>
             </div>
           </Popup>
          */}
        </Marker>
      ))}

      {/* Landmark Markers - Assuming landmarks don't have coordinates yet */}
      {landmarks.map((landmark) => {
          // Placeholder: If landmarks had lat/lng, we'd use them.
          // For now, we can't place them accurately.
          // We could place them near the map center as a fallback, but that might be confusing.
          // Example placeholder position (needs actual coordinates):
          // const landmarkPosition: LatLngTuple = [landmark.lat ?? mapCenter.lat, landmark.lng ?? mapCenter.lng];
          // For demo, let's skip rendering if no coords. In a real app, you'd fetch coords.
          return null; // Remove this line if you add lat/lng to landmarks

          /* Example if landmarks had coordinates:
          const landmarkPosition = [landmark.lat, landmark.lng] as LatLngTuple;
          return (
            <Marker
              key={landmark.title}
              position={landmarkPosition}
              icon={landmarkIcon}
              eventHandlers={{
                click: () => onMarkerClick(landmark),
              }}
            >
               <Tooltip direction="top" offset={[0, -20]}>
                 {landmark.title}
               </Tooltip>
               <Popup>
                <div>
                    <h3 className="font-semibold">{landmark.title}</h3>
                    <p className="text-xs text-muted-foreground mb-1">{landmarkSummaries[landmark.title] || landmark.description.substring(0, 100) + '...'}</p>
                     <a
                         href={landmark.wikipediaUrl}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="text-xs text-primary hover:underline"
                     >
                         View on Wikipedia
                     </a>
                 </div>
               </Popup>
            </Marker>
           );
          */
        })}

    </MapContainer>
  );
};

export default MapDisplay;

    