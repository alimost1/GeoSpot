
/**
 * Represents a geographical location with latitude and longitude coordinates.
 */
export interface Location {
  /**
   * The latitude of the location.
   */
  lat: number;
  /**
   * The longitude of the location.
   */
  lng: number;
}

/**
 * Represents a Wikipedia landmark.
 */
export interface Landmark {
  /**
   * The title of the landmark.
   */
  title: string;
  /**
   * A short description of the landmark.
   */
  description: string;
  /**
   * URL of the landmark in Wikipedia.
   */
  wikipediaUrl: string;
   /**
    * Optional: Latitude of the landmark.
    * NOTE: The real Wikipedia API needs specific querying for coordinates.
    * These are hardcoded for demo purposes.
    */
   lat?: number;
   /**
    * Optional: Longitude of the landmark.
    * NOTE: The real Wikipedia API needs specific querying for coordinates.
    * These are hardcoded for demo purposes.
    */
   lng?: number;
}

/**
 * Asynchronously retrieves a list of landmarks for a given location.
 *
 * **NOTE:** This is a mock implementation. A real implementation would:
 * 1. Call the Wikipedia API (e.g., using the geosearch action).
 * 2. Query for pages near the given latitude and longitude.
 * 3. Potentially make follow-up requests to get descriptions or more details.
 * 4. Parse the API response to extract title, description, URL, and coordinates.
 *
 * @param location The location for which to retrieve landmarks.
 * @returns A promise that resolves to a list of Landmark objects.
 */
export async function getLandmarks(location: Location): Promise<Landmark[]> {
  console.log(`Mock fetching landmarks near: Lat ${location.lat}, Lng ${location.lng}`);

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Return mock data relevant to the default Paris location for demonstration
  // In a real scenario, these would come from the Wikipedia API based on 'location'
  return [
    {
      title: 'Eiffel Tower',
      description: 'A wrought-iron lattice tower on the Champ de Mars in Paris, France. It is one of the most recognizable structures in the world.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Eiffel_Tower',
      lat: 48.8584, // Actual coordinates
      lng: 2.2945
    },
    {
      title: 'Louvre Museum',
      description: 'The world\'s largest art museum and a historic monument in Paris, France. A central landmark of the city, it is located on the Right Bank of the Seine.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Louvre',
      lat: 48.8606, // Actual coordinates
      lng: 2.3376
    },
     {
       title: 'Notre-Dame Cathedral',
       description: 'A medieval Catholic cathedral on the Île de la Cité in the 4th arrondissement of Paris. The cathedral, dedicated to the Virgin Mary, is considered one of the finest examples of French Gothic architecture.',
       wikipediaUrl: 'https://en.wikipedia.org/wiki/Notre-Dame_de_Paris',
       lat: 48.8530, // Actual coordinates
       lng: 2.3499
     },
     {
         title: 'Arc de Triomphe',
         description: 'One of the most famous monuments in Paris, France, standing at the western end of the Champs-Élysées at the centre of Place Charles de Gaulle.',
         wikipediaUrl: 'https://en.wikipedia.org/wiki/Arc_de_Triomphe',
         lat: 48.8738, // Actual coordinates
         lng: 2.2950
       },
  ];
}
 
    