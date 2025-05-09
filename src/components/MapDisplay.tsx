
'use client';

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Tooltip as LeafletTooltip } from 'react-leaflet';
import L, { type LatLngExpression, type LatLngTuple, type Map as LeafletMap } from 'leaflet';
import type { User, Landmark as LandmarkType } from '@/types';
import { Landmark as LandmarkLucideIcon, User as UserLucideIcon } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';
import { Skeleton } from '@/components/ui/skeleton';

// Custom User Icon
const userIconSvg = ReactDOMServer.renderToString(<UserLucideIcon size={24} color="hsl(var(--primary))" />);
const userIcon = L.divIcon({
  html: userIconSvg,
  className: 'bg-transparent border-none',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
});

// Custom Landmark Icon
const landmarkIconSvg = ReactDOMServer.renderToString(<LandmarkLucideIcon size={24} color="hsl(var(--chart-3))" />);
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
const MapEvents = ({ onMove, setMapInstance }: { onMove: (center: LatLngExpression) => void, setMapInstance: (map: LeafletMap | null) => void }) => {
  const map = useMapEvents({
    load: () => {
      setMapInstance(map);
    },
    moveend: () => {
      if (map) {
        onMove(map.getCenter());
      }
    },
  });

  // Effect to ensure map instance is updated in parent and cleaned up
  useEffect(() => {
    setMapInstance(map); // Set map instance (could be null initially from useMapEvents)
    return () => {
      setMapInstance(null); // Clear map instance when MapEvents unmounts
    };
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
  const mapRef = useRef<LeafletMap | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [currentCenter, setCurrentCenter] = useState<LatLngExpression>(center);

  const setMapInstance = useCallback((map: LeafletMap | null) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      // Cleanup function: VERY IMPORTANT for Leaflet
      const mapToRemove = mapRef.current;
      if (mapToRemove) {
        mapToRemove.remove();
      }
      mapRef.current = null;
      // setIsMounted(false); // Not strictly necessary here as component is unmounting
    };
  }, []);

  useEffect(() => {
    if (JSON.stringify(center) !== JSON.stringify(currentCenter)) {
      setCurrentCenter(center);
    }
  }, [center, currentCenter]);

  useEffect(() => {
    if (isMounted && mapRef.current && currentCenter) {
        const currentMapCenter = mapRef.current.getCenter();
        let targetLat: number, targetLng: number;

        if (Array.isArray(currentCenter)) {
            [targetLat, targetLng] = currentCenter as LatLngTuple;
        } else {
            targetLat = currentCenter.lat;
            targetLng = currentCenter.lng;
        }

        const tolerance = 0.00001;
        if (
          Math.abs(currentMapCenter.lat - targetLat) > tolerance ||
          Math.abs(currentMapCenter.lng - targetLng) > tolerance
        ) {
            try {
                mapRef.current.setView(currentCenter);
            } catch (error) {
                console.error("Error setting map view:", error, "Center:", currentCenter);
            }
        }
    }
  }, [currentCenter, isMounted, mapRef]); // Added mapRef to deps

  useEffect(() => {
    const focusedItem = selectedUser || selectedLandmark;
    if (isMounted && mapRef.current && focusedItem) {
      let targetLatLng: LatLngExpression | null = null;

      if (selectedUser) {
        targetLatLng = selectedUser.location;
      } else if (selectedLandmark && selectedLandmark.lat && selectedLandmark.lng) {
        targetLatLng = [selectedLandmark.lat, selectedLandmark.lng];
      }

      if (targetLatLng) {
        try {
          const currentZoom = mapRef.current.getZoom();
          mapRef.current.flyTo(targetLatLng, Math.max(currentZoom, 15), { duration: 0.5 });
        } catch (error) {
          console.error("Error flying to location:", error, "Target:", targetLatLng);
        }
      }
    }
  }, [selectedUser, selectedLandmark, isMounted, mapRef]); // Added mapRef to deps


  if (!isMounted) {
    return <Skeleton className="w-full h-full" />;
  }

  return (
     <MapContainer
         center={currentCenter}
         zoom={13}
         style={{ height: '100%', width: '100%' }}
       >
       <TileLayer
         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
         attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       />
        <MapEvents onMove={onMove} setMapInstance={setMapInstance} />

       {users.map((user) => (
         <Marker
           key={`user-${user.id}`}
           position={user.location}
           icon={userIcon}
           eventHandlers={{
             click: () => onMarkerClick(user),
           }}
         >
           <LeafletTooltip direction="top" offset={[0, -24]}>
             {user.name}
           </LeafletTooltip>
           <Popup minWidth={90}>
               <div className="text-center">
                  <h3 className="font-semibold text-sm mb-1">{user.name}</h3>
                </div>
            </Popup>
         </Marker>
       ))}

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
                <LeafletTooltip direction="top" offset={[0, -24]}>
                  {landmark.title}
                </LeafletTooltip>
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

 const MapDisplay = memo(MapDisplayComponent);
 MapDisplay.displayName = 'MapDisplay';

 export default MapDisplay;
