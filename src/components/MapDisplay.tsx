
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

// MapEvents component to handle map interactions and instance assignment
const MapEvents = ({ onMove, setMapInstance }: { onMove: (center: LatLngExpression) => void, setMapInstance: (map: Map | null) => void }) => {
  const map = useMapEvents({
    moveend: () => {
      if (map) {
        onMove(map.getCenter());
      }
    },
    load: () => { // Assign map instance on load
        if (map) {
            setMapInstance(map);
            // console.log("Map instance assigned via load event:", map);
        }
    }
  });

  // Effect to handle unmount cleanup within MapEvents if needed,
  // though the main component's cleanup should suffice.
  // Also handles the case where the component might render before the map is fully loaded.
  useEffect(() => {
      if (map) {
        setMapInstance(map);
        // console.log("Map instance (re)assigned via useEffect:", map);
      }
      // No specific cleanup needed here as the main component handles map.remove()
  }, [map, setMapInstance]);


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
  const mapContainerRef = useRef<HTMLDivElement | null>(null); // Ref for the map container div
  const [isMounted, setIsMounted] = useState(false);
  // Internal state for center to avoid direct mutation or loops if parent state changes rapidly
  const [currentCenter, setCurrentCenter] = useState<LatLngExpression>(center);

  // Callback to set the map instance from MapEvents
  const setMapInstance = (map: Map | null) => {
     if (!mapRef.current && map) {
          // console.log("Setting map instance ref");
          mapRef.current = map;
     } else if (mapRef.current && !map) {
          // console.log("Clearing map instance ref");
          mapRef.current = null;
     }
   };

  // Effect to handle client-side mounting and cleanup
  useEffect(() => {
    setIsMounted(true);
    // console.log("MapDisplay mounted");

    // Cleanup function: VERY IMPORTANT for Leaflet and preventing init errors
    return () => {
      // console.log("MapDisplay unmounting");
      if (mapRef.current) {
        // Check if it's a valid Leaflet map instance with a remove method
        if (typeof mapRef.current.remove === 'function') {
          // console.log("Attempting to remove map instance");
          try {
            mapRef.current.remove();
            // console.log("Map instance removed successfully");
          } catch (e) {
            console.error("Error removing map instance on unmount:", e);
          }
        } else {
          console.warn("mapRef.current exists but does not have a remove method.");
        }
        // Explicitly set ref to null after removal
        mapRef.current = null;
      }
      setIsMounted(false); // Reset mounted state on unmount
    };
  }, []); // Empty dependency array: runs only on mount and unmount

  // Effect to update internal center state ONLY when the center prop *actually* changes
  useEffect(() => {
    // Basic comparison, might need deep comparison for complex LatLngExpression objects
    if (JSON.stringify(center) !== JSON.stringify(currentCenter)) {
      // console.log("Center prop changed, updating internal state:", center);
      setCurrentCenter(center);
    }
  }, [center]); // Depend only on the center prop

  // Effect to programmatically move the map ONLY when internal center changes
  // This avoids conflicts with user pan/zoom actions.
  useEffect(() => {
    if (isMounted && mapRef.current && currentCenter) {
        const currentMapCenter = mapRef.current.getCenter();
        let targetLat: number, targetLng: number;

        if (Array.isArray(currentCenter)) {
            [targetLat, targetLng] = currentCenter;
        } else {
            targetLat = currentCenter.lat;
            targetLng = currentCenter.lng;
        }

        // Check if centers are different enough to warrant a programmatic move
        const tolerance = 0.00001; // Small tolerance for float comparison
        if (
          Math.abs(currentMapCenter.lat - targetLat) > tolerance ||
          Math.abs(currentMapCenter.lng - targetLng) > tolerance
        ) {
            try {
                // console.log("Programmatically setting map view to:", currentCenter);
                mapRef.current.setView(currentCenter); // Use setView for immediate change without animation
            } catch (error) {
                console.error("Error setting map view:", error, "Center:", currentCenter);
            }
        }
    }
    // Depend on internal center and mount status. Also mapRef.current to ensure map is ready.
  }, [currentCenter, isMounted, mapRef.current]);


  // Effect to fly to selected marker
  useEffect(() => {
    const focusedItem = selectedUser || selectedLandmark;
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
          // console.log(`Flying to ${selectedUser ? 'user' : 'landmark'}:`, targetLatLng);
          mapRef.current.flyTo(targetLatLng, Math.max(currentZoom, 15), { duration: 0.5 });
          // Optionally update internal center AFTER flying if needed, but be cautious of loops
          // setCurrentCenter(targetLatLng);
        } catch (error) {
          console.error("Error flying to location:", error, "Target:", targetLatLng);
        }
      }
    }
  }, [selectedUser, selectedLandmark, isMounted, mapRef.current]); // Add mapRef.current dependency


  // Render placeholder if not mounted yet
  if (!isMounted) {
    // console.log("Rendering Skeleton (not mounted)");
    // Use a div with the ref for the MapContainer to attach to later
    return <div ref={mapContainerRef} className="w-full h-full"><Skeleton className="w-full h-full" /></div>;
  }


  // Render MapContainer only when mounted. Attach ref to the container div.
  // MapContainer needs a defined container element.
  // console.log("Rendering MapContainer with internal center:", currentCenter);
  return (
     <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }}>
         {/* Conditionally render MapContainer only when the container div is available */}
         {mapContainerRef.current && (
             <MapContainer
                 // Do NOT use whenCreated/whenReady here as MapEvents handles instance assignment via hooks
                 center={currentCenter} // Use internal state for initial center
                 zoom={13}
                 style={{ height: '100%', width: '100%' }}
                 // Assign the container explicitly (though often not needed if direct child)
                 // container={mapContainerRef.current} // This prop doesn't exist on MapContainer
               >
               <TileLayer
                 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                 attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
               />
                {/* MapEvents component handles map instance and events */}
                <MapEvents onMove={onMove} setMapInstance={setMapInstance} />

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
         )}
     </div>
   );
 };

 // Memoize the component to prevent unnecessary re-renders if props haven't changed deeply
 const MapDisplay = memo(MapDisplayComponent);
 MapDisplay.displayName = 'MapDisplay'; // Set display name for React DevTools

 export default MapDisplay;

