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
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
      console.log("Geocoding Request URL:", url.replace(this.apiKey || "", "AIza...REDACTED"));

      const response = await fetch(url);
      const data = await response.json();

      console.log("Geocoding Full Google Response:", JSON.stringify(data, null, 2));

      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          formattedAddress: result.formatted_address
        };
      } else {
        const errorMsg = data.error_message || "No error message provided by Google.";
        console.error(`Geocoding failed with status: ${data.status}`);
        console.error(`Reason: ${errorMsg}`);

        switch (data.status) {
          case "ZERO_RESULTS":
            console.warn("No results found for the provided address.");
            break;
          case "OVER_QUERY_LIMIT":
            console.error("Geocoding quota exceeded.");
            break;
          case "REQUEST_DENIED":
            console.error("API Key denied. Check if Geocoding API is enabled and restrictions are correct.");
            break;
          case "INVALID_REQUEST":
            console.error("Missing address or other parameter.");
            break;
          default:
            console.error("Unknown geocoding error.");
        }

        return null;
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  }
}
