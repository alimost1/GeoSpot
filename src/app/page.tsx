'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Search, Users, Landmark as LandmarkIcon, UserPlus, UserCheck, X } from 'lucide-react';
import type { Landmark } from '@/services/wikipedia';
import { getLandmarks } from '@/services/wikipedia';
import { summarizeLandmarkInfo } from '@/ai/flows/summarize-landmark-info';
import { useToast } from '@/hooks/use-toast';
import type { LatLngExpression } from 'leaflet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { User } from '@/types';


// Dynamically import MapDisplay to avoid SSR issues with Leaflet
const MapDisplay = dynamic(() => import('@/components/MapDisplay'), {
  ssr: false,
});

// Mock user data using User type
const mockUsers: User[] = [
  { id: '1', name: 'Alice', avatar: 'https://picsum.photos/seed/alice/40/40', location: [48.8584, 2.2945], following: false, "data-ai-hint": "person face" }, // Near Eiffel Tower
  { id: '2', name: 'Bob', avatar: 'https://picsum.photos/seed/bob/40/40', location: [48.8606, 2.3376], following: true, "data-ai-hint": "man portrait" }, // Near Louvre
  { id: '3', name: 'Charlie', avatar: 'https://picsum.photos/seed/charlie/40/40', location: [48.8530, 2.3499], following: false, "data-ai-hint": "woman smiling" }, // Near Notre Dame
];

export default function Home() {
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([48.8566, 2.3522]); // Default to Paris
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [profileName, setProfileName] = useState<string>('Current User');
  const [isProfileEditing, setIsProfileEditing] = useState<boolean>(false);
  const [isLoadingLandmarks, setIsLoadingLandmarks] = useState<boolean>(false);
  const [landmarkSummaries, setLandmarkSummaries] = useState<Record<string, string>>({});
  const [refreshId, setRefreshId] = useState(0); // Used to trigger manual refresh

  const { toast } = useToast();

  useEffect(() => {
    const loadDataForCurrentCenter = async (currentCenter: LatLngExpression) => {
      setIsLoadingLandmarks(true);
      setLandmarks([]); // Clear previous landmarks to show loading state

      try {
        const location = Array.isArray(currentCenter)
          ? { lat: currentCenter[0], lng: currentCenter[1] }
          : { lat: currentCenter.lat, lng: currentCenter.lng };

        const newFetchedLandmarks = await getLandmarks(location);
        setLandmarks(newFetchedLandmarks);

        // Fetch summaries for newly fetched landmarks
        // We iterate and update summaries one by one using functional updates
        // to avoid issues with stale closures and ensure individual updates.
        const landmarkTitlesBeingSummarized = new Set<string>();
        
        const summaryPromises = newFetchedLandmarks.map(async (landmark) => {
          // Check if summary exists in current state (captured at effect run time) or is already being fetched in this batch
          if (landmarkSummaries[landmark.title] || landmarkTitlesBeingSummarized.has(landmark.title)) {
            // If summary exists and we want to ensure it's up-to-date, we could re-fetch.
            // For now, if it exists in the initial landmarkSummaries snapshot for this effect run, assume it's okay.
            // Or, always fetch, and let `summarizeLandmarkInfo` be idempotent.
            // To keep it simple: if not in current `landmarkSummaries` state object when this effect ran, fetch it.
            // This means if `landmarkSummaries` was updated by another process, this might re-fetch.
            // The `landmarkTitlesBeingSummarized` prevents duplicate fetches within *this specific batch*.
            
            // A more robust check against current state would be to use setLandmarkSummaries(prev => { if (prev[title]) ... })
            // but that becomes complex with async map.
            // For this iteration, we rely on the initial state of landmarkSummaries for the check,
            // and `landmarkTitlesBeingSummarized` for in-batch deduplication.
            // If `landmarkSummaries` itself were a dep, it would loop.
             if (landmarkSummaries[landmark.title]) return; // Skip if summary was already in the state when effect started
          }
          
          if(landmarkTitlesBeingSummarized.has(landmark.title)) return; // Already processing in this batch
          landmarkTitlesBeingSummarized.add(landmark.title);

          try {
            const result = await summarizeLandmarkInfo({
              title: landmark.title,
              description: landmark.description,
              wikipediaUrl: landmark.wikipediaUrl,
            });
            setLandmarkSummaries(prev => ({ ...prev, [landmark.title]: result.summary }));
          } catch (error) {
            console.error(`Error summarizing landmark ${landmark.title}:`, error);
            setLandmarkSummaries(prev => ({ ...prev, [landmark.title]: "Summary unavailable." }));
          }
        });
        await Promise.all(summaryPromises);

      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch data for the current map area.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingLandmarks(false);
      }
    };

    if (mapCenter) {
      loadDataForCurrentCenter(mapCenter);
    }
  // Dependencies:
  // - mapCenter: Triggers fetch when map moves.
  // - refreshId: Triggers fetch for manual refresh.
  // - toast: For showing error messages. Stable reference from useToast.
  // - State setters (setLandmarks, setIsLoadingLandmarks, setLandmarkSummaries): Stable references.
  // - getLandmarks, summarizeLandmarkInfo: Imported functions, stable references.
  // - landmarkSummaries (the state object itself) is intentionally NOT a dependency here to prevent loops.
  //   It's read once when the effect runs to decide initial summary fetches.
  }, [mapCenter, refreshId, toast, setLandmarks, setIsLoadingLandmarks, setLandmarkSummaries]);


  const handleMapMove = useCallback((center: LatLngExpression) => {
    setMapCenter(center);
  }, [setMapCenter]); 

  const handleDiscoverLandmarks = useCallback(() => {
    setRefreshId(id => id + 1); // Trigger the useEffect by changing refreshId
  }, [setRefreshId]);

  const handleFollowToggle = useCallback((userId: string) => {
    setUsers(prevUsers => {
      let toggledUserInstance: User | undefined;
      const newUsers = prevUsers.map(user => {
        if (user.id === userId) {
          toggledUserInstance = { ...user, following: !user.following };
          return toggledUserInstance;
        }
        return user;
      });

      if (toggledUserInstance) {
        toast({
          title: toggledUserInstance.following ? 'Followed' : 'Unfollowed',
          description: `You ${toggledUserInstance.following ? 'followed' : 'unfollowed'} ${toggledUserInstance.name}.`,
        });

        if (selectedUser?.id === userId) {
          setSelectedUser(prevSelectedUser => 
            prevSelectedUser ? { ...prevSelectedUser, following: (toggledUserInstance as User).following } : null
          );
        }
      }
      return newUsers;
    });
  }, [selectedUser, toast, setUsers, setSelectedUser]);

  const handleProfileSave = () => {
    setIsProfileEditing(false);
    toast({
      title: 'Profile Updated',
      description: 'Your profile information has been saved.',
    });
  };

  const handleMarkerClick = useCallback((item: User | Landmark) => {
     if ('location' in item) { 
       setSelectedUser(item);
       setSelectedLandmark(null);
       setMapCenter(item.location);
     } else { 
       setSelectedLandmark(item);
       setSelectedUser(null);
        if (item.lat && item.lng) {
            setMapCenter([item.lat, item.lng]);
        }
     }
   }, [setMapCenter, setSelectedUser, setSelectedLandmark]);


  return (
    <div className="flex h-screen w-screen bg-background text-foreground relative overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-border flex flex-col h-full absolute left-0 top-0 z-10 bg-card shadow-lg transition-transform duration-300 ease-in-out transform translate-x-0">
        <div className="p-4 flex items-center justify-between border-b border-border">
          <h1 className="text-2xl font-bold text-primary flex items-center">
            <MapPin className="mr-2 h-6 w-6" />
            GeoSpot
          </h1>
        </div>

        <ScrollArea className="flex-1">
          {/* Profile Section */}
          <div className="p-4">
            <Card className="mb-4 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">My Profile</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsProfileEditing(!isProfileEditing)}>
                  {isProfileEditing ? 'Cancel' : 'Edit'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4 mb-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src="https://picsum.photos/seed/currentuser/64/64" alt="My Avatar" data-ai-hint="profile avatar" />
                    <AvatarFallback>{profileName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {isProfileEditing ? (
                    <Input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="text-xl font-semibold"
                    />
                  ) : (
                    <p className="text-xl font-semibold">{profileName}</p>
                  )}
                </div>
                {isProfileEditing && (
                  <Button onClick={handleProfileSave} className="w-full">Save Profile</Button>
                )}
              </CardContent>
            </Card>
            <Separator className="my-4" />
          </div>


          {/* Landmark Discovery */}
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-2 flex items-center"><LandmarkIcon className="mr-2 h-5 w-5" /> Discover Landmarks</h2>
            <Button onClick={handleDiscoverLandmarks} className="w-full mb-4" disabled={isLoadingLandmarks}>
              <Search className="mr-2 h-4 w-4" />
              {isLoadingLandmarks ? 'Loading...' : 'Find Nearby Landmarks'}
            </Button>
            {isLoadingLandmarks && landmarks.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Loading landmarks...</p>}
            {!isLoadingLandmarks && landmarks.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Nearby Landmarks</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 max-h-48 overflow-y-auto">
                    {landmarks.map((landmark) => (
                      <li
                        key={landmark.title}
                        className="flex items-start space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors duration-150"
                        onClick={() => handleMarkerClick(landmark)}
                      >
                        <LandmarkIcon className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                         <div>
                           <p className="font-medium text-sm">{landmark.title}</p>
                           <p className="text-xs text-muted-foreground">
                             {landmarkSummaries[landmark.title] || (landmark.description ? landmark.description.substring(0, 50) + '...' : 'No description available.')}
                            </p>
                         </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
             {!isLoadingLandmarks && landmarks.length === 0 && (
                 <p className="text-sm text-muted-foreground text-center py-2">No landmarks found nearby. Click "Find Nearby Landmarks" to search.</p>
             )}
          </div>

           <Separator className="my-4" />


          {/* Connections */}
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-2 flex items-center"><Users className="mr-2 h-5 w-5" /> Connections</h2>
             <Card className="shadow-sm mb-4">
               <CardHeader className="pb-2">
                 <CardTitle className="text-base font-medium">Following</CardTitle>
               </CardHeader>
               <CardContent>
                  <TooltipProvider>
                    <ul className="space-y-3 max-h-48 overflow-y-auto">
                      {users.filter(user => user.following).map((user) => (
                        <li key={user.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent transition-colors duration-150">
                           <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleMarkerClick(user)}>
                             <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatar} alt={user.name} data-ai-hint={user["data-ai-hint"]}/>
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                             </Avatar>
                             <span className="text-sm font-medium">{user.name}</span>
                           </div>
                             <Tooltip>
                               <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFollowToggle(user.id)}>
                                    <UserCheck className="h-4 w-4 text-primary" />
                                  </Button>
                               </TooltipTrigger>
                               <TooltipContent>
                                 <p>Unfollow {user.name}</p>
                               </TooltipContent>
                             </Tooltip>
                         </li>
                      ))}
                       {users.filter(user => user.following).length === 0 && (
                         <p className="text-sm text-muted-foreground text-center py-2">You are not following anyone yet.</p>
                       )}
                     </ul>
                   </TooltipProvider>
               </CardContent>
             </Card>
             <Card className="shadow-sm">
                <CardHeader className="pb-2">
                 <CardTitle className="text-base font-medium">Suggestions</CardTitle>
               </CardHeader>
                <CardContent>
                  <TooltipProvider>
                    <ul className="space-y-3 max-h-48 overflow-y-auto">
                       {users.filter(user => !user.following).map((user) => (
                        <li key={user.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent transition-colors duration-150">
                           <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleMarkerClick(user)}>
                             <Avatar className="h-8 w-8">
                               <AvatarImage src={user.avatar} alt={user.name} data-ai-hint={user["data-ai-hint"]} />
                               <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                             </Avatar>
                             <span className="text-sm font-medium">{user.name}</span>
                           </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFollowToggle(user.id)}>
                                    <UserPlus className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Follow {user.name}</p>
                                </TooltipContent>
                              </Tooltip>
                         </li>
                       ))}
                       {users.filter(user => !user.following).length === 0 && (
                           <p className="text-sm text-muted-foreground text-center py-2">No suggestions right now.</p>
                         )}
                     </ul>
                   </TooltipProvider>
                </CardContent>
             </Card>
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content Area - Map */}
      <main className="flex-1 h-full pl-80">
         <MapDisplay
           center={mapCenter}
           users={users}
           landmarks={landmarks}
           onMove={handleMapMove}
           onMarkerClick={handleMarkerClick}
           selectedUser={selectedUser}
           selectedLandmark={selectedLandmark}
           landmarkSummaries={landmarkSummaries}
         />
      </main>

       {(selectedUser || selectedLandmark) && (
         <Card className="absolute bottom-4 right-4 w-80 z-20 shadow-xl transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-bottom-5">
           <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex-1 pr-2">
                <CardTitle className="text-lg font-semibold leading-tight">
                  {selectedUser?.name || selectedLandmark?.title}
                </CardTitle>
                {selectedLandmark && (
                  <a
                     href={selectedLandmark.wikipediaUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-xs text-primary hover:underline block mt-1"
                   >
                     View on Wikipedia
                   </a>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1 flex-shrink-0" onClick={() => { setSelectedUser(null); setSelectedLandmark(null); }}>
                 <X className="h-4 w-4" />
                 <span className="sr-only">Close</span>
             </Button>
           </CardHeader>
           <CardContent>
             {selectedUser && (
               <div className="flex items-center space-x-3">
                 <Avatar className="h-10 w-10">
                   <AvatarImage src={selectedUser.avatar} alt={selectedUser.name} data-ai-hint={selectedUser["data-ai-hint"]} />
                   <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                 </Avatar>
                 <Button
                   variant={selectedUser.following ? 'secondary' : 'default'}
                   size="sm"
                   onClick={() => handleFollowToggle(selectedUser.id)}
                  >
                  {selectedUser.following ? <UserCheck className="mr-2 h-4 w-4"/> : <UserPlus className="mr-2 h-4 w-4"/>}
                   {selectedUser.following ? 'Following' : 'Follow'}
                 </Button>
               </div>
             )}
             {selectedLandmark && (
               <p className="text-sm text-muted-foreground">
                  {landmarkSummaries[selectedLandmark.title] || (selectedLandmark.description ? selectedLandmark.description : 'No description available.')}
                </p>
              )}
           </CardContent>
         </Card>
       )}
    </div>
  );
}
