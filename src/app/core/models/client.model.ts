import { VehicleKind } from './vehicle-brand.model';

export type { VehicleKind };

export interface Address {
  street: string;
  postcode: string;
  city: string;
}

/** Vehicle file: identity and registration document (carte grise) */
export interface Vehicle {
  id: string;
  /** Brand / model as free text ("Kia Ceed 1.5 T-GDi") */
  name: string;
  /** Licence plate ("VD 232 067") */
  plate: string;
  kind: VehicleKind;
  /** Photo of the registration document, or null when none */
  registrationImage: string | null;
  /** Note about the vehicle / its registration document */
  registrationNote: string;
}

export interface Client {
  id: string;
  name: string;
  address: Address;
  /** Hourly rate used for its invoices (id of a `company.json` hourly rate) */
  rateId: string;
  /** Vehicles known for this client */
  vehicles: Vehicle[];
  /**
   * No longer active, but kept with its worksheets and invoices (a client with documents is
   * archived instead of deleted): listed apart, not suggested on new worksheets
   */
  archived?: boolean;
}

export type ClientChanges = Partial<Pick<Client, 'name' | 'address' | 'rateId'>>;
export type VehicleChanges = Partial<Omit<Vehicle, 'id'>>;
