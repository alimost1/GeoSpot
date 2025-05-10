// src/components/MapDisplay.tsx
'use client'; // Ensures client-side rendering for Leaflet

import React, { useEffect, useState, useCallback } from 'react';
import L, { LatLngExpression, Map as LeafletMap } from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup as ReactLeafletPopup, useMap, useMapEvents } from 'react-leaflet';
import type { User, Landmark } from '@/types'; // Corrected import path
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

// Default Leaflet icon fix (ensure this runs only on client)
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}


const userIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const landmarkIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png', // Example: Red marker for landmarks
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});


interface MapDisplayProps {
  center: LatLngExpression;
  zoomLevel?: number;
  users: User[];
  landmarks: Landmark[];
  onMove?: (center: LatLngExpression, zoom: number) => void;
  onMarkerClick: (item: User | Landmark) => void;
  selectedUser: User | null;
  selectedLandmark: Landmark | null;
  landmarkSummaries?: Record<string, string>;
  onMapLoad?: (map: LeafletMap) => void;
}

// Component to handle map events and imperative updates
const MapController: React.FC<{
  onMove?: (center: LatLngExpression, zoom: number) => void;
  onMapLoad?: (map: LeafletMap) => void;
  center: LatLngExpression;
  zoom: number;
  selectedItem: User | Landmark | null;
}> = ({ onMove, onMapLoad, center, zoom, selectedItem }) => {
  const map = useMap();

  useEffect(() => {
    if (onMapLoad) {
      onMapLoad(map);
    }
  }, [map, onMapLoad]);

  useMapEvents({
    moveend: () => {
      if (onMove) {
        const newCenter = map.getCenter();
        const newZoom = map.getZoom();
        // Check if onMove is different from the last call to prevent potential loops if parent updates state
        onMove(newCenter, newZoom);
      }
    },
    zoomend: () => {
      if (onMove) {
        const newCenter = map.getCenter();
        const newZoom = map.getZoom();
        onMove(newCenter, newZoom);
      }
    },
  });

  // Effect to handle programmatic map view changes (center, zoom from props)
  useEffect(() => {
    const currentMapPos = map.getCenter();
    const targetLatLng = L.latLng(center as L.LatLngTuple); // Ensure center is LatLng compatible

    const needsViewUpdate =
      Math.abs(currentMapPos.lat - targetLatLng.lat) > 0.0001 ||
      Math.abs(currentMapPos.lng - targetLatLng.lng) > 0.0001 ||
      map.getZoom() !== zoom;

    if (needsViewUpdate) {
      map.flyTo(targetLatLng, zoom);
    }
  }, [map, center, zoom]);

  // Effect to handle flying to selected item
  useEffect(() => {
    if (selectedItem) {
      let itemLocation: LatLngExpression | undefined;
      if ('location' in selectedItem && selectedItem.location) {
        itemLocation = selectedItem.location;
      } else if ('lat' in selectedItem && 'lng' in selectedItem && selectedItem.lat != null && selectedItem.lng != null) {
        itemLocation = [selectedItem.lat, selectedItem.lng];
      }

      if (itemLocation) {
        const targetZoom = Math.max(map.getZoom(), 15); 
        map.flyTo(L.latLng(itemLocation as L.LatLngTuple), targetZoom);
      }
    }
  }, [map, selectedItem]);

  return null;
};


export const MapDisplayComponent: React.FC<MapDisplayProps> = ({
  center: initialCenter,
  zoomLevel: initialZoomLevel = 13,
  users,
  landmarks,
  onMove,
  onMarkerClick,
  selectedUser,
  selectedLandmark,
  landmarkSummaries,
  onMapLoad,
}) => {
  // These states hold the *initial* values for the map.
  // The MapController will handle subsequent updates based on prop changes.
  const [currentMapCenter] = useState<LatLngExpression>(initialCenter);
  const [currentMapZoom] = useState<number>(initialZoomLevel);

  if (typeof window === 'undefined') {
    return null; 
  }

  return (
     <MapContainer
         center={currentMapCenter} 
         zoom={currentMapZoom}    
         style={{ height: '100%', width: '100%' }}
     >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapController
        onMove={onMove}
        onMapLoad={onMapLoad}
        center={initialCenter} // Pass the current prop value for controlled updates
        zoom={initialZoomLevel} // Pass the current prop value for controlled updates
        selectedItem={selectedUser || selectedLandmark}
      />

      {users.map(user => (
        user.location && (
          <Marker
            key={`user-${user.id}`}
            position={user.location}
            icon={userIcon}
            eventHandlers={{ click: () => onMarkerClick(user) }}
          >
            <ReactLeafletPopup>
              <Card className="border-none shadow-none w-48">
                <CardHeader className="p-2 flex flex-row items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar} alt={user.name} data-ai-hint={user['data-ai-hint']} />
                      <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-sm">{user.name}</CardTitle>
                </CardHeader>
              </Card>
            </ReactLeafletPopup>
          </Marker>
        )
      ))}

      {landmarks.map(landmark => (
        landmark.lat != null && landmark.lng != null && (
          <Marker
            key={`landmark-${landmark.id}`}
            position={[landmark.lat, landmark.lng]}
            icon={landmarkIcon}
            eventHandlers={{ click: () => onMarkerClick(landmark) }}
          >
            <ReactLeafletPopup>
               <Card className="border-none shadow-none w-60">
                <CardHeader className="p-2">
                    <CardTitle className="text-sm">{landmark.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-2 text-xs space-y-1">
                    <p className="line-clamp-2 text-muted-foreground">{landmark.description}</p>
                    {landmarkSummaries?.[landmark.id as string] && (
                        <p className="mt-1 text-primary-foreground bg-primary/80 p-1 rounded-sm text-[10px] leading-tight">
                           <strong>AI:</strong> {landmarkSummaries[landmark.id as string]}
                        </p>
                    )}
                    {landmark.wikipediaUrl && (
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs" asChild>
                             <a href={landmark.wikipediaUrl} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                        </Button>
                    )}
                </CardContent>
              </Card>
            </ReactLeafletPopup>
          </Marker>
        )
      ))}
    </MapContainer>
  );
};
