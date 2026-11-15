export interface Client {
  id: string;
  name: string;
  /** Vehicles known for this client (brand / model as free text) */
  vehicles: string[];
}
