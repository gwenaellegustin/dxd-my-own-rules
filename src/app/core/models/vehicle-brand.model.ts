export interface VehicleBrand {
  id: string;
  name: string;
  /** Lower-case words that identify the brand in a free-text vehicle (e.g. "vw" for Volkswagen) */
  aliases: string[];
  /** Logo path, relative to the app base URL; absent when no logo is available */
  logo?: string;
  /** Type of vehicle, for the icon shown when there is no logo (default: car) */
  kind?: VehicleKind;
}

export type VehicleKind = 'car' | 'motorcycle';
