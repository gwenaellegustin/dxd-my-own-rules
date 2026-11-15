export interface VehicleBrand {
  id: string;
  name: string;
  /** Lower-case words that identify the brand in a free-text vehicle (e.g. "vw" for Volkswagen) */
  aliases: string[];
  /** Logo path, relative to the app base URL */
  logo: string;
}
