export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export class GeocodingService {
  private static apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  static async geocode(address: string): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      console.warn("Geocoding API Key missing, returning mock coordinates.");
      return {
        latitude: 51.1912,
        longitude: 6.4422,
        formattedAddress: address
      };
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`
      );
      const data = await response.json();

      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          formattedAddress: result.formatted_address
        };
      } else {
        console.error("Geocoding failed:", data.status);
        return null;
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  }
}
