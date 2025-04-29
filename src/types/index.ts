import type { LatLngExpression } from 'leaflet';
import type { Landmark as WikipediaLandmark } from '@/services/wikipedia';


// Extend WikipediaLandmark if needed, or use it directly
export interface Landmark extends WikipediaLandmark {
  // Add any additional properties specific to your app, like coordinates if fetched separately
  // lat?: number;
  // lng?: number;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  location: LatLngExpression; // Use Leaflet's type for location
  following: boolean;
}
