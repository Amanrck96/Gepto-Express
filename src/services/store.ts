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
 * Represents a store with its information and location.
 */
export interface Store {
  /**
   * The ID of the store.
   */
  id: string;
  /**
   * The name of the store.
   */
  name: string;
  /**
   * The location of the store.
   */
  location: Location;
  /**
   * The store's address.
   */
  address: string;
  /**
   * The store's average rating.
   */
  rating: number;
}

/**
 * Asynchronously retrieves a list of stores within a specified radius of a given location.
 *
 * @param location The center location for the search.
 * @param radius The radius around the location to search within, in kilometers.
 * @returns A promise that resolves to an array of Store objects.
 */
export async function getNearbyStores(location: Location, radius: number): Promise<Store[]> {
  // TODO: Implement this by calling an API.
  return [
    {
      id: 'store1',
      name: 'Grocery Mart',
      location: {
        lat: 26.3260,
        lng: 89.4457,
      },
      address: 'Cooch Behar, WB',
      rating: 4.5,
    },
    {
      id: 'store2',
      name: 'Fresh Foods',
      location: {
        lat: 26.3250,
        lng: 89.4467,
      },
      address: 'Cooch Behar, WB',
      rating: 4.2,
    },
  ];
}
