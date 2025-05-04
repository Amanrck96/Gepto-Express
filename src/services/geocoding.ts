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
 * Represents an address.
 */
export interface Address {
  /**
   * The full address string.
   */
  formattedAddress: string;
}

/**
 * Asynchronously retrieves address information for a given location.
 * @param location The location for which to retrieve address data.
 * @returns A promise that resolves to an Address object containing the formatted address.
 */
export async function getAddress(location: Location): Promise<Address> {
  // TODO: Implement this by calling an API.
  return {
    formattedAddress: 'Cooch Behar, West Bengal, India'
  };
}

/**
 * Asynchronously retrieves location information for a given address.
 *
 * @param address The address for which to retrieve location data.
 * @returns A promise that resolves to a Location object containing latitude and longitude.
 */
export async function getLocation(address: string): Promise<Location> {
  // TODO: Implement this by calling an API.
  return {
    lat: 26.3260,
    lng: 89.4457
  };
}
