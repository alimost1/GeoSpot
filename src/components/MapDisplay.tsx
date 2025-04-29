
'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Tooltip } from 'react-leaflet';
import L, { type LatLngExpression, type LatLngTuple, type Map } from 'leaflet';
import type { User, Landmark as LandmarkType } from '@/types';
import { Landmark, User as UserIcon } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Custom User Icon
const userIconSvg = ReactDOMServer.renderToString(<UserIcon size={24} color="hsl(var(--primary))" />);
const userIcon = L.divIcon({
  html: userIconSvg,
  className: 'bg-transparent border-none',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
});

// Custom Landmark Icon
const landmarkIconSvg = ReactDOMServer.renderToString(<Landmark size={24} color="hsl(var(--chart-3))" />);
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

// MapEvents component to handle map interactions
const MapEvents = ({ onMove, mapRef }: { onMove: (center: LatLngExpression) => void, mapRef: React.MutableRefObject<Map | null> }) => {
  const map = useMapEvents({
    moveend: () => {
      onMove(map.getCenter());
    },
    load: () => {
        // Ensure mapRef is assigned only once when the map loads
        if (mapRef.current === null) {
           // @ts-ignore Type safety for Leaflet instance might differ slightly
           mapRef.current = map;
        }
    }
  });
   // Backup assignment in case load event doesn't fire as expected in some scenarios
   if (mapRef.current === null && map) {
      // @ts-ignore Type safety for Leaflet instance might differ slightly
      mapRef.current = map;
   }
  return null;
};


const MapDisplayComponent: React.FC<MapDisplayProps> = ({
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
  const [isMounted, setIsMounted] = useState(false);
  const [currentCenter, setCurrentCenter] = useState<LatLngExpression>(center); // Internal state for center


  // Effect to handle client-side mounting
   useEffect(() => {
      setIsMounted(true);
      // Optional: Cleanup function if map instance needs manual destruction
      return () => {
        // If mapRef.current exists and has a remove method, call it
        // This helps prevent memory leaks if the component unmounts unexpectedly
        // Be cautious with this, as react-leaflet might handle cleanup internally
        // if (mapRef.current && typeof mapRef.current.remove === 'function') {
        //   console.log("Removing map instance");
        //   mapRef.current.remove();
        //   mapRef.current = null;
        // }
        // setIsMounted(false); // Reset mounted state on unmount
      };
    }, []);


  // Effect to update internal center state when the prop changes
   useEffect(() => {
     setCurrentCenter(center);
   }, [center]);


  // Effect to programmatically update map view ONLY when internal center changes
  // This avoids conflicts with user interactions moving the map.
  useEffect(() => {
    if (isMounted && mapRef.current && currentCenter) {
        const currentMapCenter = mapRef.current.getCenter();
        // Check if centers are different enough to warrant a programmatic move
        // This prevents loops where moving the map triggers this effect
        if (
          (Array.isArray(currentCenter) && (currentMapCenter.lat !== currentCenter[0] || currentMapCenter.lng !== currentCenter[1])) ||
          (!Array.isArray(currentCenter) && (currentMapCenter.lat !== currentCenter.lat || currentMapCenter.lng !== currentCenter.lng))
        ) {
             try {
                 mapRef.current.setView(currentCenter);
             } catch (error) {
                  console.error("Error setting map view:", error, "Center:", currentCenter);
             }
        }
    }
  }, [currentCenter, isMounted]); // Depend only on internal center and mounted state


  // Effect to fly to selected marker
   const focusedItem = selectedUser || selectedLandmark;
   useEffect(() => {
     if (isMounted && focusedItem && mapRef.current) {
       let targetLatLng: LatLngExpression | null = null;

       if (selectedUser) {
         targetLatLng = selectedUser.location;
       } else if (selectedLandmark && selectedLandmark.lat && selectedLandmark.lng) {
         targetLatLng = [selectedLandmark.lat, selectedLandmark.lng];
       }

       if (targetLatLng) {
         try {
           const currentZoom = mapRef.current.getZoom();
           // Fly to the location, zoom in if map is zoomed out, maintain zoom otherwise
           mapRef.current.flyTo(targetLatLng, Math.max(currentZoom, 15), { duration: 0.5 });
           setCurrentCenter(targetLatLng); // Update internal center as well
         } catch (error) {
           console.error("Error flying to location:", error, "Target:", targetLatLng);
         }
       }
     }
   }, [selectedUser, selectedLandmark, isMounted]); // Removed currentCenter dependency


  // Render placeholder if not mounted yet
  if (!isMounted) {
     return <Skeleton className="w-full h-full" />;
  }


  // Render MapContainer only when mounted
  // Using a key derived from a stable property or just `isMounted` can help force remount if needed, but often isn't necessary.
  // Avoid using `center` directly as key if it changes frequently from parent.
  return (
     <MapContainer
         key={String(isMounted)} // Use isMounted as key to potentially help React differentiate
         center={currentCenter} // Use internal state for center
         zoom={13}
         style={{ height: '100%', width: '100%' }}
         // Remove the ref prop here, let MapEvents handle it via useMapEvents hook
         // ref={mapInstance => { ... }} // REMOVED
       >
       <TileLayer
         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
         attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       />
        {/* MapEvents component handles map instance and events */}
        <MapEvents onMove={onMove} mapRef={mapRef} />

       {/* User Markers */}
       {users.map((user) => (
         <Marker
           key={`user-${user.id}`}
           position={user.location}
           icon={userIcon}
           eventHandlers={{
             click: () => onMarkerClick(user),
           }}
         >
           <Tooltip direction="top" offset={[0, -24]}>
             {user.name}
           </Tooltip>
           <Popup minWidth={90}>
               <div className="text-center">
                  <h3 className="font-semibold text-sm mb-1">{user.name}</h3>
                </div>
            </Popup>
         </Marker>
       ))}

       {/* Landmark Markers */}
       {landmarks.filter(landmark => landmark.lat && landmark.lng).map((landmark) => {
           const landmarkPosition = [landmark.lat!, landmark.lng!] as LatLngTuple;
           return (
             <Marker
               key={`landmark-${landmark.title}`}
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
                 <div className="w-64">
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

 // Memoize the component to prevent unnecessary re-renders if props haven't changed deeply
 const MapDisplay = memo(MapDisplayComponent);
 MapDisplay.displayName = 'MapDisplay'; // Set display name for React DevTools

 export default MapDisplay;
