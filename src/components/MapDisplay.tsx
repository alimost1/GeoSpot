// src/app/page.tsx
import React, { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css'; // CRITICAL: Import Leaflet's CSS

// Assuming these types are defined and exported from MapDisplay.tsx or a shared types file
import type { User, Landmark } from '@/components/MapDisplay'; // Adjust path if necessary
import type { LatLngExpression } from 'leaflet';

// If you are using shadcn/ui Skeleton
import { Skeleton } from '@/components/ui/skeleton'; // Adjust path if necessary

// Dynamically import MapDisplay component to ensure it only runs on the client-side
const DynamicMapDisplay = dynamic(
  () => import('@/components/MapDisplay'), // Adjust path to your MapDisplay.tsx
  {
    ssr: false, // Ensure component is not rendered on the server
    loading: () => ( // Optional: loading component while MapDisplay is being loaded
      <div style={{ height: '500px', width: '100%' }} role="status" aria-label="Loading map...">
        <Skeleton className="w-full h-full" />
      </div>
    ),
  }
);

export default function HomePage() {
  // Example state for map properties
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([51.505, -0.09]); // Initial center
  const [selectedItem, setSelectedItem] = useState<User | Landmark | null>(null);

  // Example data (should be memoized if derived from props or complex state)
  const users = useMemo<User[]>(() => [
    { id: 1, name: 'User Alice', location: [51.51, -0.1] },
    { id: 2, name: 'User Bob', location: [51.50, -0.08] },
  ], []);

  const landmarks = useMemo<Landmark[]>(() => [
    { id: 'lm1', title: 'Big Ben', lat: 51.5007, lng: -0.1246, description: 'Famous clock tower.' },
    { id: 'lm2', title: 'London Eye', lat: 51.5033, lng: -0.1195, description: 'Ferris wheel.' },
  ], []);

  // Callbacks (should be wrapped in useCallback to maintain stable references)
  const handleMapMove = useCallback((newCenter: LatLngExpression) => {
    console.log('Map moved to:', newCenter);
    // If you want to update the center state from map interaction:
    // setMapCenter(newCenter); // Be careful of loops if this prop also drives map.setView
  }, []);

  const handleMarkerClick = useCallback((item: User | Landmark) => {
    console.log('Marker clicked:', item);
    setSelectedItem(item);
    // Example: If item has location or lat/lng, pan to it
    if ('location' in item && item.location) {
        setMapCenter(item.location); // This will trigger propCenter change in MapDisplay
    } else if ('lat' in item && 'lng' in item && item.lat !== null && item.lng !== null) {
        setMapCenter([item.lat, item.lng]);
    }
  }, []);


  return (
    <div style={{ padding: '20px' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1>Interactive Leaflet Map</h1>
        <p>
          If you see "Map container is already initialized", try setting
          `reactStrictMode: false` in `next.config.js` and restarting the dev server.
        </p>
        {selectedItem && (
          <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #ccc' }}>
            Selected: {'name' in selectedItem ? selectedItem.name : selectedItem.title}
          </div>
        )}
      </header>

      <main>
        <div style={{ height: '60vh', minHeight: '400px', width: '100%', border: '1px solid #000' }}>
          <DynamicMapDisplay
            center={mapCenter}
            users={users}
            landmarks={landmarks}
            onMove={handleMapMove}
            onMarkerClick={handleMarkerClick}
            selectedUser={selectedItem && 'location' in selectedItem ? selectedItem as User : null}
            selectedLandmark={selectedItem && 'lat' in selectedItem ? selectedItem as Landmark : null}
            // landmarkSummaries={{}} // Optional
            zoomLevel={13}
          />
        </div>
        <button onClick={() => setMapCenter([34.0522, -118.2437])} style={{marginTop: '10px', padding: '8px'}}>
            Go to Los Angeles
        </button>
      </main>
    </div>
  );
}