// src/app/page.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css'; // CRITICAL: Import Leaflet's CSS

import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import type { User, Landmark } from '@/types'; // Using combined types from src/types
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MapPin, Users, Info, Link as LinkIcon, Search, Loader2 } from 'lucide-react';
import { summarizeLandmarkInfo, SummarizeLandmarkInfoOutput } from '@/ai/flows/summarize-landmark-info';
import { getLandmarks } from '@/services/wikipedia';
import { Input } from '@/components/ui/input';

// Dynamically import MapDisplay component to ensure it only runs on the client-side
const DynamicMapDisplay = dynamic(
  () => import('@/components/MapDisplay').then(mod => mod.MapDisplayComponent), // Ensure to get the named export
  {
    ssr: false,
    loading: () => (
      <div className="h-[60vh] min-h-[400px] w-full flex items-center justify-center bg-muted rounded-lg shadow-md" role="status" aria-label="Loading map...">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Loading Map...</p>
      </div>
    ),
  }
);


const initialUsers: User[] = [
  { id: 'user1', name: 'Alice Wonderland', avatar: 'https://picsum.photos/seed/alice/100/100', "data-ai-hint": "woman portrait", location: [48.8600, 2.3400], following: true },
  { id: 'user2', name: 'Bob The Builder', avatar: 'https://picsum.photos/seed/bob/100/100', "data-ai-hint": "man construction", location: [48.8550, 2.3450], following: false },
  { id: 'user3', name: 'Charlie Chaplin', avatar: 'https://picsum.photos/seed/charlie/100/100', "data-ai-hint": "classic actor", location: [48.8650, 2.3350], following: true },
];

const initialLandmarks: Landmark[] = [
    {
      id: 'lm1',
      title: 'Eiffel Tower',
      lat: 48.8584,
      lng: 2.2945,
      description: 'A wrought-iron lattice tower on the Champ de Mars in Paris, France. It is one of the most recognizable structures in the world.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Eiffel_Tower',
    },
    {
      id: 'lm2',
      title: 'Louvre Museum',
      lat: 48.8606,
      lng: 2.3376,
      description: 'The world\'s largest art museum and a historic monument in Paris, France. A central landmark of the city, it is located on the Right Bank of the Seine.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Louvre',
    },
];


export default function HomePage() {
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([48.8566, 2.3522]); // Paris
  const [currentZoom, setCurrentZoom] = useState<number>(13);
  const [selectedItem, setSelectedItem] = useState<User | Landmark | null>(null);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [landmarks, setLandmarks] = useState<Landmark[]>(initialLandmarks);
  const [landmarkSummaries, setLandmarkSummaries] = useState<Record<string, string>>({});
  const [isLoadingSummary, setIsLoadingSummary] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<(User | Landmark)[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);

  const displayedUsers = useMemo(() => searchTerm ? searchResults.filter(item => 'avatar' in item) as User[] : users, [searchTerm, searchResults, users]);
  const displayedLandmarks = useMemo(() => searchTerm ? searchResults.filter(item => !('avatar' in item)) as Landmark[] : landmarks, [searchTerm, searchResults, landmarks]);


  const handleMapMove = useCallback((newCenter: LatLngExpression, newZoom: number) => {
    // console.log('Map moved to:', newCenter, 'Zoom:', newZoom);
    // Only update if the change is significant to avoid jitter
    // if (mapCenter[0].toFixed(4) !== (newCenter as number[])[0].toFixed(4) || mapCenter[1].toFixed(4) !== (newCenter as number[])[1].toFixed(4)) {
    //   setMapCenter(newCenter);
    // }
    // if (currentZoom !== newZoom) {
    //   setCurrentZoom(newZoom);
    // }
  }, []);

  const handleMarkerClick = useCallback((item: User | Landmark) => {
    setSelectedItem(item);
    let itemLocation: LatLngExpression;
    if ('location' in item && item.location) {
      itemLocation = item.location;
    } else if ('lat' in item && 'lng' in item && item.lat != null && item.lng != null) {
      itemLocation = [item.lat, item.lng];
    } else {
      return;
    }
    
    if (mapInstance) {
        mapInstance.flyTo(itemLocation, mapInstance.getZoom() < 15 ? 15: mapInstance.getZoom());
    } else {
        setMapCenter(itemLocation); // Fallback if mapInstance is not yet available
        setCurrentZoom(currentZoom < 15 ? 15 : currentZoom);
    }

    if ('description' in item && !landmarkSummaries[item.id] && !isLoadingSummary[item.id]) {
      setIsLoadingSummary(prev => ({ ...prev, [item.id as string]: true }));
      summarizeLandmarkInfo({
        title: item.title,
        description: item.description,
        wikipediaUrl: item.wikipediaUrl || '',
      })
        .then((summaryOutput: SummarizeLandmarkInfoOutput) => {
          setLandmarkSummaries(prev => ({ ...prev, [item.id as string]: summaryOutput.summary }));
        })
        .catch(error => {
          console.error("Error fetching summary:", error);
          setLandmarkSummaries(prev => ({ ...prev, [item.id as string]: "Could not load summary." }));
        })
        .finally(() => {
          setIsLoadingSummary(prev => ({ ...prev, [item.id as string]: false }));
        });
    }
  }, [landmarkSummaries, isLoadingSummary, mapInstance, currentZoom]);

  const handleFollowToggle = (userId: string) => {
    setUsers(prevUsers =>
      prevUsers.map(user =>
        user.id === userId ? { ...user, following: !user.following } : user
      )
    );
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.trim() === '') {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    // Simulate search delay
    setTimeout(() => {
      const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(term.toLowerCase())
      );
      const filteredLandmarks = landmarks.filter(landmark =>
        landmark.title.toLowerCase().includes(term.toLowerCase())
      );
      setSearchResults([...filteredUsers, ...filteredLandmarks]);
      setIsSearching(false);
    }, 300);
  };

  useEffect(() => {
    // Fetch initial landmarks (simulated) if not already populated by search or other means
    if(landmarks.length === 0) {
        getLandmarks({ lat: mapCenter[0] as number, lng: mapCenter[1] as number })
            .then(fetchedLandmarks => {
                const landmarksWithIds = fetchedLandmarks.map((lm, index) => ({...lm, id: `serviceLm${index}`}));
                setLandmarks(landmarksWithIds);
            })
            .catch(console.error);
    }
  }, [mapCenter]);


  return (
    <TooltipProvider>
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-96 p-6 border-r border-border flex flex-col space-y-6 overflow-y-auto shadow-lg">
        <div className="flex items-center space-x-2">
          <MapPin className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">GeoSpot</h1>
        </div>
        <p className="text-sm text-muted-foreground">Discover and share your world. Click on markers to learn more or use the search below.</p>

        <div className="relative">
          <Input
            type="search"
            placeholder="Search users or landmarks..."
            value={searchTerm}
            onChange={handleSearch}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        </div>

        <Tabs defaultValue="users" className="flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users"><Users className="inline-block mr-2 h-4 w-4" />Users</TabsTrigger>
            <TabsTrigger value="landmarks"><MapPin className="inline-block mr-2 h-4 w-4" />Landmarks</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-3">
              {isSearching && searchTerm && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
              {!isSearching && searchTerm && displayedUsers.length === 0 && <p className="text-center text-muted-foreground p-4">No users found.</p>}
              <div className="space-y-4">
                {displayedUsers.map(user => (
                  <Card key={user.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleMarkerClick(user)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={user.avatar} alt={user.name} data-ai-hint={user['data-ai-hint']}/>
                          <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-lg">{user.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground pb-2">
                      Location: {Array.isArray(user.location) ? `${user.location[0].toFixed(4)}, ${user.location[1].toFixed(4)}` : 'Unknown'}
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant={user.following ? 'secondary' : 'default'}
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleFollowToggle(user.id); }}
                        className="w-full"
                      >
                        {user.following ? 'Unfollow' : 'Follow'}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="landmarks" className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-3">
               {isSearching && searchTerm && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
              {!isSearching && searchTerm && displayedLandmarks.length === 0 && <p className="text-center text-muted-foreground p-4">No landmarks found.</p>}
              <div className="space-y-4">
                {displayedLandmarks.map(landmark => (
                  <Card key={landmark.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleMarkerClick(landmark)}>
                    <CardHeader>
                      <CardTitle className="text-lg">{landmark.title}</CardTitle>
                      {landmark.wikipediaUrl && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a href={landmark.wikipediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center" onClick={(e) => e.stopPropagation()}>
                              <LinkIcon className="h-3 w-3 mr-1"/> Wikipedia
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View on Wikipedia</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm line-clamp-3">{landmark.description}</CardDescription>
                      {isLoadingSummary[landmark.id as string] && <div className="mt-2 flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading summary...</div>}
                      {landmarkSummaries[landmark.id as string] && (
                        <p className="mt-2 text-sm text-primary-foreground bg-primary/80 p-2 rounded-md shadow">
                          <strong>AI Summary:</strong> {landmarkSummaries[landmark.id as string]}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </aside>

      {/* Main content - Map */}
      <main className="flex-1 flex flex-col relative">
        {selectedItem && (
            <Card className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-80 shadow-xl bg-card/90 backdrop-blur-sm">
                 <CardHeader>
                    <CardTitle className="text-xl">
                        {'name' in selectedItem ? selectedItem.name : selectedItem.title}
                    </CardTitle>
                    {'avatar' in selectedItem && selectedItem.avatar ? (
                         <Avatar className="w-16 h-16 mt-2">
                            <AvatarImage src={selectedItem.avatar} alt={selectedItem.name} data-ai-hint={selectedItem['data-ai-hint']} />
                            <AvatarFallback>{selectedItem.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                    ) : null}
                 </CardHeader>
                 <CardContent>
                     {'description' in selectedItem && (
                        <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                     )}
                     {'location' in selectedItem && (
                        <p className="text-sm text-muted-foreground">
                            Location: {Array.isArray(selectedItem.location) ? `${selectedItem.location[0].toFixed(4)}, ${selectedItem.location[1].toFixed(4)}` : 'Unknown'}
                        </p>
                     )}
                     {'lat' in selectedItem && selectedItem.lat != null && selectedItem.lng != null && (
                        <p className="text-sm text-muted-foreground">
                            Coordinates: {selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}
                        </p>
                     )}
                 </CardContent>
                <CardFooter>
                    <Button variant="outline" size="sm" onClick={() => setSelectedItem(null)}>Close</Button>
                </CardFooter>
            </Card>
        )}

        <div className="flex-grow rounded-lg overflow-hidden m-2 shadow-2xl border border-border">
            <DynamicMapDisplay
                center={mapCenter}
                zoomLevel={currentZoom}
                users={displayedUsers}
                landmarks={displayedLandmarks}
                onMove={handleMapMove}
                onMarkerClick={handleMarkerClick}
                selectedUser={selectedItem && 'avatar' in selectedItem ? selectedItem as User : null}
                selectedLandmark={selectedItem && !('avatar' in selectedItem) ? selectedItem as Landmark : null}
                landmarkSummaries={landmarkSummaries}
                onMapLoad={setMapInstance} // Pass the callback to set the map instance
            />
        </div>
        <div className="p-2 flex justify-center space-x-2">
            <Button onClick={() => mapInstance?.setView([34.0522, -118.2437], 12)} variant="outline">Go to Los Angeles</Button>
            <Button onClick={() => mapInstance?.setView([51.5074, 0.1278], 12)} variant="outline">Go to London</Button>
            <Button onClick={() => mapInstance?.setView([35.6895, 139.6917], 12)} variant="outline">Go to Tokyo</Button>
        </div>
      </main>
    </div>
    </TooltipProvider>
  );
}
