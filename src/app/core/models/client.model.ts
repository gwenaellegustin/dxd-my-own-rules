export interface Address {
  street: string;
  postcode: string;
  city: string;
}

export interface Vehicle {
  /** Brand / model as free text ("Kia Ceed 1.5 T-GDi") */
  name: string;
  /** Licence plate ("VD 232 067") */
  plate: string;
}

export interface Client {
  id: string;
  name: string;
  address: Address;
  /** Vehicles known for this client */
  vehicles: Vehicle[];
}
