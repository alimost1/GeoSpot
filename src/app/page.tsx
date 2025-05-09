
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
import { MapPin, Search, Users, Landmark as LandmarkIcon, UserPlus, UserCheck, X } from 'lucide-react'; // Import X
import type { Landmark } from '@/services/wikipedia';
import { getLandmarks } from '@/services/wikipedia';
import { summarizeLandmarkInfo } from '@/ai/flows/summarize-landmark-info';
import { useToast } from '@/hooks/use-toast';
import type { LatLngExpression } from 'leaflet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { User } from '@/types'; // Import User type


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

  const { toast } = useToast();

  const fetchLandmarks = useCallback(async (center: LatLngExpression) => {
    setIsLoadingLandmarks(true);
    setLandmarks([]); // Clear previous landmarks while loading
    setLandmarkSummaries({}); // Clear summaries
    try {
      // Convert LatLngExpression to Location object
      const location = Array.isArray(center)
        ? { lat: center[0], lng: center[1] }
        : { lat: center.lat, lng: center.lng };

      const fetchedLandmarks = await getLandmarks(location);
      setLandmarks(fetchedLandmarks);
      // Fetch summaries for new landmarks
      // Note: fetchSummaries is not wrapped in useCallback here, if it had complex dependencies it should be.
      // For now, it's called from within fetchLandmarks which is already memoized.
      const summariesToFetchFor = fetchedLandmarks.filter(lm => !landmarkSummaries[lm.title]);
      if (summariesToFetchFor.length > 0) {
        fetchSummaries(summariesToFetchFor);
      }
    } catch (error) {
      console.error('Error fetching landmarks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch landmarks. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingLandmarks(false);
    }
  }, [toast, landmarkSummaries]); // landmarkSummaries dependency for fetchSummaries logic


  const fetchSummaries = useCallback(async (landmarksToSummarize: Landmark[]) => {
    const newSummaries: Record<string, string> = {};
     const fetchPromises = landmarksToSummarize.map(async (landmark) => {
         try {
           const result = await summarizeLandmarkInfo({
             title: landmark.title,
             description: landmark.description,
             wikipediaUrl: landmark.wikipediaUrl,
           });
           newSummaries[landmark.title] = result.summary;
         } catch (error) {
           console.error(`Error summarizing landmark ${landmark.title}:`, error);
           newSummaries[landmark.title] = "Summary unavailable.";
         }
     });

     await Promise.all(fetchPromises);
     setLandmarkSummaries(prev => ({ ...prev, ...newSummaries }));
  }, [setLandmarkSummaries]);


  useEffect(() => {
    // Initial landmark fetch on component mount
    fetchLandmarks(mapCenter);
  }, [fetchLandmarks, mapCenter]);


  const handleMapMove = useCallback((center: LatLngExpression) => {
    setMapCenter(center);
  }, []); // setMapCenter is stable

  const handleDiscoverLandmarks = useCallback(() => {
    fetchLandmarks(mapCenter);
  }, [fetchLandmarks, mapCenter]);

  const handleFollowToggle = (userId: string) => {
    setUsers(prevUsers =>
      prevUsers.map(user =>
        user.id === userId ? { ...user, following: !user.following } : user
      )
    );
    const userToggled = users.find(u => u.id === userId);
    if (userToggled) {
      toast({
        title: userToggled.following ? 'Unfollowed' : 'Followed',
        description: `You ${userToggled.following ? 'unfollowed' : 'followed'} ${userToggled.name}.`,
      });
    }
    if (selectedUser?.id === userId) {
      setSelectedUser(prev => prev ? { ...prev, following: !prev.following } : null);
    }
  };

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
   }, [setSelectedUser, setSelectedLandmark, setMapCenter]);


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
            {isLoadingLandmarks && <p className="text-sm text-muted-foreground text-center py-2">Loading landmarks...</p>}
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
                 <p className="text-sm text-muted-foreground text-center py-2">No landmarks found nearby.</p>
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
                        <TooltipProvider>
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
                         </TooltipProvider>
                       </li>
                    ))}
                     {users.filter(user => user.following).length === 0 && (
                       <p className="text-sm text-muted-foreground text-center py-2">You are not following anyone yet.</p>
                     )}
                   </ul>
               </CardContent>
             </Card>
             {/* <Separator className="my-4" /> */}
             <Card className="shadow-sm">
                <CardHeader className="pb-2">
                 <CardTitle className="text-base font-medium">Suggestions</CardTitle>
               </CardHeader>
                <CardContent>
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
                         <TooltipProvider>
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
                          </TooltipProvider>
                       </li>
                     ))}
                     {users.filter(user => !user.following).length === 0 && (
                         <p className="text-sm text-muted-foreground text-center py-2">No suggestions right now.</p>
                       )}
                   </ul>
                </CardContent>
             </Card>
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content Area - Map */}
      <main className="flex-1 h-full pl-80"> {/* Add padding to offset the fixed sidebar */}
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

       {/* Selected Item Overlay Card - Animated */}
       {(selectedUser || selectedLandmark) && (
         <Card className="absolute bottom-4 right-4 w-80 z-20 shadow-xl transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-bottom-5">
           <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex-1 pr-2"> {/* Allow title to wrap */}
                <CardTitle className="text-lg font-semibold leading-tight">
                  {selectedUser?.name || selectedLandmark?.title}
                </CardTitle>
                {selectedLandmark && (
                  <a
                     href={selectedLandmark.wikipediaUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-xs text-primary hover:underline block mt-1" // Block for better spacing
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


    