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

// Simplified MapEvents component, solely for handling map interaction events.
// It gets the map instance from useMapEvents context.
const MapEventsHandler = ({ onMove }: { onMove: (center: LatLngExpression) => void }) => {
  const map = useMapEvents({
    moveend: () => {
      if (map) { // map instance from useMapEvents
        onMove(map.getCenter());
      }
    },
  });
  return null; // This component does not render anything visible
};


const MapDisplayComponent: React.FC<MapDisplayProps> = ({
  center: propCenter, // Renamed to avoid confusion
  users,
  landmarks,
  onMove,
  onMarkerClick,
  selectedUser,
  selectedLandmark,
  landmarkSummaries,
}) => {
  const mapRef = useRef<LeafletMap | null>(null);
  const [isClient, setIsClient] = useState(false);
  // currentMapCenter is used for the MapContainer's initial center.
  // Subsequent view changes are handled by effects using mapRef.current.setView/flyTo.
  const [currentMapCenter, setCurrentMapCenter] = useState<LatLngExpression>(propCenter);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update currentMapCenter if the incoming propCenter changes.
  // This is mainly for the initial render or if MapContainer needs re-initialization with a new center.
  useEffect(() => {
    setCurrentMapCenter(propCenter);
  }, [propCenter]);

  // Effect for programmatically setting map view when propCenter changes
  useEffect(() => {
    if (mapRef.current && propCenter) {
      const map = mapRef.current;
      const currentViewCenter = map.getCenter();
      let targetLat: number, targetLng: number;

      if (Array.isArray(propCenter)) {
        [targetLat, targetLng] = propCenter as LatLngTuple;
      } else {
        targetLat = propCenter.lat;
        targetLng = propCenter.lng;
      }

      const tolerance = 0.00001; // A small tolerance for float comparison
      if (
        // Check if map is ready and if the center is actually different
        typeof map.setView === 'function' &&
        (Math.abs(currentViewCenter.lat - targetLat) > tolerance ||
         Math.abs(currentViewCenter.lng - targetLng) > tolerance)
      ) {
        map.setView(propCenter);
      }
    }
  }, [propCenter]); // Runs when propCenter changes

  // Effect for flying to the selected user or landmark
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      const focusedItem = selectedUser || selectedLandmark;
      let targetLatLng: LatLngExpression | null = null;

      if (selectedUser) {
        targetLatLng = selectedUser.location;
      } else if (selectedLandmark?.lat && selectedLandmark?.lng) {
        targetLatLng = [selectedLandmark.lat, selectedLandmark.lng];
      }

      if (targetLatLng && typeof map.flyTo === 'function') {
        const currentZoom = map.getZoom();
        map.flyTo(targetLatLng, Math.max(currentZoom, 15), { duration: 0.5 });
      }
    }
  }, [selectedUser, selectedLandmark]); // Runs when selectedUser or selectedLandmark changes

  // CRUCIAL: Cleanup Leaflet map instance when the component unmounts
  useEffect(() => {
    // This effect's cleanup function will run when MapDisplayComponent unmounts.
    return () => {
      if (mapRef.current && typeof mapRef.current.remove === 'function') {
        mapRef.current.remove(); // Destroy the Leaflet map instance
      }
      mapRef.current = null; // Clear the ref
    };
  }, []); // Empty dependency array ensures this runs once on mount for setup, and cleanup on unmount.


  if (!isClient) {
    // Render a skeleton or null while waiting for client-side mount,
    // as Leaflet requires a browser environment.
    return <Skeleton className="w-full h-full" />;
  }

  return (
     <MapContainer
         // The 'center' prop for MapContainer sets the initial view.
         // Subsequent view changes are handled by map.setView() or map.flyTo() in effects.
         center={currentMapCenter}
         zoom={13}
         style={{ height: '100%', width: '100%' }}
         // whenCreated is called once the Leaflet map instance is ready.
         whenCreated={(mapInstance) => {
           mapRef.current = mapInstance;
           // If propCenter was different from the initial mapInstance center, update it.
           // This ensures the map reflects the latest propCenter after initialization.
           if (propCenter) {
                const currentViewCenter = mapInstance.getCenter();
                let targetLat: number, targetLng: number;
                if (Array.isArray(propCenter)) { [targetLat, targetLng] = propCenter as LatLngTuple;}
                else { targetLat = propCenter.lat; targetLng = propCenter.lng; }
                const tolerance = 0.00001;
                if (Math.abs(currentViewCenter.lat - targetLat) > tolerance || Math.abs(currentViewCenter.lng - targetLng) > tolerance) {
                    mapInstance.setView(propCenter);
                }
           }
         }}
       >
       <TileLayer
         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
         attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       />
        {/* Attach the simplified event handler component */}
        <MapEventsHandler onMove={onMove} />

       {/* Markers and Popups */}
       {users.map((user) => (
         <Marker
           key={`user-${user.id}`}
           position={user.location}
           icon={userIcon}
           eventHandlers={{ click: () => onMarkerClick(user) }}
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