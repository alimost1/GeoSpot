
'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Tooltip } from 'react-leaflet';
import L, { type LatLngExpression, type LatLngTuple, type Map } from 'leaflet';
import type { User, Landmark as LandmarkType } from '@/types';
import { Landmark, User as UserIcon } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';
import { Button } from '@/components/ui/button'; // Import Button for popup actions if needed

// Custom User Icon
const userIconSvg = ReactDOMServer.renderToString(<UserIcon size={24} color="hsl(var(--primary))" />); // Use theme color
const userIcon = L.divIcon({
  html: userIconSvg,
  className: 'bg-transparent border-none',
  iconSize: [24, 24],
  iconAnchor: [12, 24], // Point of the icon which will correspond to marker's location
  popupAnchor: [0, -24] // Point from which the popup should open relative to the iconAnchor
});

// Custom Landmark Icon (Example using a different color)
const landmarkIconSvg = ReactDOMServer.renderToString(<Landmark size={24} color="hsl(var(--chart-3))" />); // Example: Orange from theme
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
  landmarkSummaries: Record<string, string>;
}

const MapEvents = ({ onMove, mapRef }: { onMove: (center: LatLngExpression) => void, mapRef: React.RefObject<Map | null> }) => {
  const map = useMapEvents({
    moveend: () => {
      if (mapRef.current) { // Ensure mapRef is current
         onMove(mapRef.current.getCenter());
      }
    },
     load: () => { // Ensure mapRef is set on load
       if (mapRef) {
         // @ts-ignore
         mapRef.current = map;
       }
     }
  });
  // Ensure mapRef is updated if the map instance changes
  if (mapRef && mapRef.current !== map) {
     // @ts-ignore
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
    // Check if mapRef is current and center is valid before setting view
    if (mapRef.current && center && typeof center !== 'string' && (Array.isArray(center) || ('lat' in center && 'lng' in center))) {
       try {
         mapRef.current.setView(center);
       } catch (error) {
         console.error("Error setting map view:", error, "Center:", center);
       }
    }
  }, [center]);


  // Determine the marker to focus on
  const focusedItem = selectedUser || selectedLandmark;
  useEffect(() => {
    if (focusedItem && mapRef.current) {
      let targetLatLng: LatLngExpression | null = null;

      if (selectedUser) {
        targetLatLng = selectedUser.location;
      } else if (selectedLandmark && selectedLandmark.lat && selectedLandmark.lng) {
        // Use landmark coordinates if available
        targetLatLng = [selectedLandmark.lat, selectedLandmark.lng];
      }

      if (targetLatLng) {
         try {
           mapRef.current.flyTo(targetLatLng, mapRef.current.getZoom() < 15 ? 15 : mapRef.current.getZoom()); // Fly to the location, zoom in if needed
         } catch (error) {
           console.error("Error flying to location:", error, "Target:", targetLatLng);
         }
      }
    }
  }, [selectedUser, selectedLandmark]);


  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} whenCreated={mapInstance => { mapRef.current = mapInstance; }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapEvents onMove={onMove} mapRef={mapRef} />

      {/* User Markers */}
      {users.map((user) => (
        <Marker
          key={`user-${user.id}`} // Add prefix for clarity
          position={user.location}
          icon={userIcon}
          eventHandlers={{
            click: () => onMarkerClick(user),
          }}
        >
          <Tooltip direction="top" offset={[0, -24]}>
            {user.name}
          </Tooltip>
          {/* Keep Popup commented out unless needed
           <Popup>
             <div>
               <h3>{user.name}</h3>
               <Button size="sm" onClick={() => console.log('Follow clicked from popup')}>Follow</Button>
             </div>
           </Popup>
           */}
        </Marker>
      ))}

      {/* Landmark Markers */}
      {landmarks.filter(landmark => landmark.lat && landmark.lng).map((landmark) => {
          const landmarkPosition = [landmark.lat!, landmark.lng!] as LatLngTuple; // Assert non-null lat/lng
          return (
            <Marker
              key={`landmark-${landmark.title}`} // Add prefix
              position={landmarkPosition}
              icon={landmarkIcon}
              eventHandlers={{
                click: () => onMarkerClick(landmark),
              }}
            >
               <Tooltip direction="top" offset={[0, -24]}>
                 {landmark.title}
               </Tooltip>
               <Popup>
                <div className="w-64"> {/* Set a max width for the popup */}
                    <h3 className="font-semibold text-base mb-1">{landmark.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                       {landmarkSummaries[landmark.title] || landmark.description.substring(0, 150) + (landmark.description.length > 150 ? '...' : '')}
                     </p>
                     <a
                         href={landmark.wikipediaUrl}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="text-xs text-primary hover:underline inline-block"
                     >
                         View on Wikipedia
                     </a>
                 </div>
               </Popup>
            </Marker>
           );
        })}

    </MapContainer>
  );
};

export default MapDisplay;
