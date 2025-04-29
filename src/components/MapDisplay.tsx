
'use client';

import React, { useEffect, useRef, useState } from 'react'; // Import useState
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Tooltip } from 'react-leaflet';
import L, { type LatLngExpression, type LatLngTuple, type Map } from 'leaflet';
import type { User, Landmark as LandmarkType } from '@/types';
import { Landmark, User as UserIcon } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';
import { Button } from '@/components/ui/button'; // Import Button for popup actions if needed
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for placeholder

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
      // Debounce or throttle this if it causes performance issues
      if (mapRef.current) { // Ensure mapRef is current
         onMove(mapRef.current.getCenter());
      }
    },
     load: () => { // Ensure mapRef is set on load
       if (mapRef && mapRef.current === null) { // Only set if not already set
         // @ts-ignore - leaflet typing might be strict here
         mapRef.current = map;
       }
     }
  });
  // Ensure mapRef is updated if the map instance changes
  if (mapRef && mapRef.current !== map && mapRef.current === null) { // Only set if not already set
      // @ts-ignore - leaflet typing might be strict here
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
  const [isMounted, setIsMounted] = useState(false); // State to track mount

  // Set mounted state after component mounts on the client
  useEffect(() => {
    setIsMounted(true);
    // Cleanup function to potentially destroy the map instance if needed
    // return () => {
    //   if (mapRef.current) {
    //     mapRef.current.remove();
    //     mapRef.current = null;
    //   }
    // };
  }, []);

  // Effect to update map view when center changes
  useEffect(() => {
    // Check if mapRef is current, component is mounted, and center is valid before setting view
    if (isMounted && mapRef.current && center && typeof center !== 'string' && (Array.isArray(center) || ('lat' in center && 'lng' in center))) {
       try {
         // Use flyTo for smoother transitions if needed, or setView for immediate change
         mapRef.current.setView(center);
       } catch (error) {
         console.error("Error setting map view:", error, "Center:", center);
       }
    }
  }, [center, isMounted]); // Add isMounted dependency


  // Effect to fly to selected marker
  const focusedItem = selectedUser || selectedLandmark;
  useEffect(() => {
    if (isMounted && focusedItem && mapRef.current) {
      let targetLatLng: LatLngExpression | null = null;

      if (selectedUser) {
        targetLatLng = selectedUser.location;
      } else if (selectedLandmark && selectedLandmark.lat && selectedLandmark.lng) {
        // Use landmark coordinates if available
        targetLatLng = [selectedLandmark.lat, selectedLandmark.lng];
      }

      if (targetLatLng) {
         try {
           const currentZoom = mapRef.current.getZoom();
           mapRef.current.flyTo(targetLatLng, currentZoom < 15 ? 15 : currentZoom, { duration: 0.5 }); // Fly to the location, zoom in if needed
         } catch (error) {
           console.error("Error flying to location:", error, "Target:", targetLatLng);
         }
      }
    }
  }, [selectedUser, selectedLandmark, isMounted]); // Add isMounted dependency


  // Render placeholder if not mounted yet
  if (!isMounted) {
     return <Skeleton className="w-full h-full" />; // Or any other loading indicator
  }

  // Render MapContainer only when mounted
  return (
    <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        // Use ref prop instead of whenCreated for better React integration
        ref={mapInstance => {
             // Only assign ref if it's not already set to avoid re-initialization issues
             if (mapInstance && mapRef.current === null) {
                mapRef.current = mapInstance;
             }
         }}
      >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
       {/* Conditionally render MapEvents only when mapRef is ready */}
       {mapRef && <MapEvents onMove={onMove} mapRef={mapRef} />}


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
           {/* Popup for user - example */}
           <Popup minWidth={90}>
              <div className="text-center">
                 <h3 className="font-semibold text-sm mb-1">{user.name}</h3>
                 {/* Add follow button or other actions here if needed */}
                 {/* <Button size="sm" variant="outline">View Profile</Button> */}
               </div>
           </Popup>
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
                <div className="w-64"> {/* Set a width for the popup */}
                    <h3 className="font-semibold text-base mb-1">{landmark.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2 leading-snug">
                       {landmarkSummaries[landmark.title] || (landmark.description ? landmark.description.substring(0, 150) + (landmark.description.length > 150 ? '...' : '') : 'No description available.')}
                     </p>
                     <a
                         href={landmark.wikipediaUrl}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="text-xs text-primary hover:underline inline-block mt-1"
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
