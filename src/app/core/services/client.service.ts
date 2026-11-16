import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { Address, Client, ClientChanges, Vehicle, VehicleChanges, VehicleKind } from '../models/client.model';
import { VehicleBrandService } from './vehicle-brand.service';
import { sameName } from '../utils/names';


/**
 * Clients and their vehicle files, kept in memory for the prototype (replace the edit methods
 * with API calls once a backend exists). Worksheets refer to clients and vehicles by name: a
 * rename must also be applied to them (WorksheetStore.rename).
 */
@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly api = inject(ApiService);
  private readonly brands = inject(VehicleBrandService);

  private readonly _clients = signal<Client[]>([]);
  /** Clients created and not edited yet: dropped when left (see `discardIfUntouched`) */
  private readonly untouched = new Set<string>();
  readonly clients = this._clients.asReadonly();

  /** Names suggested on worksheets (not the archived clients) */
  readonly clientNames = computed(() =>
    this.clients()
      .filter((client) => !client.archived)
      .map((client) => client.name)
      .filter(Boolean),
  );

  constructor() {
    this.api.get<Client[]>(API_ENDPOINTS.clients).subscribe((clients) => this._clients.set(clients));
  }

  getById(id: string | undefined): Client | undefined {
    return this._clients().find((client) => client.id === id);
  }

  /** Vehicle names of the given client, or every known vehicle when the client is unknown */
  vehiclesFor(clientName: string): string[] {
    const client = this.byName(clientName);
    const vehicles = client ? client.vehicles : this.clients().flatMap((c) => c.vehicles);
    return [...new Set(vehicles.map((vehicle) => vehicle.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  /** Licence plate of a client's vehicle; empty when the vehicle is not known */
  plateOf(clientName: string, vehicleName: string): string {
    return this.vehicleOf(clientName, vehicleName)?.plate ?? '';
  }

  /** Client with this name (worksheets refer to clients by name), if known */
  byName(clientName: string): Client | undefined {
    return clientName.trim() ? this.clients().find((client) => sameName(client.name, clientName)) : undefined;
  }

  vehicleOf(clientName: string, vehicleName: string): Vehicle | undefined {
    return this.byName(clientName)?.vehicles.find((vehicle) => sameName(vehicle.name, vehicleName));
  }

  create(): Client {
    const client: Client = {
      id: crypto.randomUUID(),
      name: '',
      address: { street: '', postcode: '', city: '' },
      rateId: '',
      vehicles: [],
    };
    this._clients.update((list) => [...list, client]);
    this.untouched.add(client.id);
    return client;
  }

  /** A new client left without any edit is removed silently */
  discardIfUntouched(id: string): void {
    if (this.untouched.delete(id)) this.remove(id);
  }

  update(id: string, changes: ClientChanges): void {
    this.patch(id, (client) => ({ ...client, ...changes }));
  }

  updateAddress(id: string, changes: Partial<Address>): void {
    this.patch(id, (client) => ({ ...client, address: { ...client.address, ...changes } }));
  }

  /** Archived (a client with documents) or active again */
  setArchived(id: string, archived: boolean): void {
    this.patch(id, ({ archived: _was, ...client }) => (archived ? { ...client, archived: true } : client));
  }

  /** Deletes a client and its vehicle files (only clients without worksheet, see ClientsPage) */
  remove(id: string): void {
    this._clients.update((list) => list.filter((client) => client.id !== id));
  }

  addVehicle(clientId: string, name = ''): Vehicle {
    const vehicle: Vehicle = {
      id: crypto.randomUUID(),
      name,
      plate: '',
      kind: this.defaultKind(name),
      registrationImage: null,
      registrationNote: '',
    };
    this.patch(clientId, (client) => ({ ...client, vehicles: [...client.vehicles, vehicle] }));
    return vehicle;
  }

  updateVehicle(clientId: string, vehicleId: string, changes: VehicleChanges): void {
    this.patch(clientId, (client) => ({
      ...client,
      vehicles: client.vehicles.map((vehicle) => (vehicle.id === vehicleId ? { ...vehicle, ...changes } : vehicle)),
    }));
  }

  removeVehicle(clientId: string, vehicleId: string): void {
    this.patch(clientId, (client) => ({ ...client, vehicles: client.vehicles.filter((v) => v.id !== vehicleId) }));
  }

  /**
   * Vehicle file of a worksheet's vehicle, created (with its client) when not known yet.
   * Null without a client name.
   */
  ensureVehicle(clientName: string, vehicleName: string): { clientId: string; vehicleId: string } | null {
    if (!clientName.trim()) return null;
    let client = this.byName(clientName);
    if (!client) {
      client = this.create();
      this.update(client.id, { name: clientName.trim() });
    }
    const vehicle = this.vehicleOf(clientName, vehicleName) ?? this.addVehicle(client.id, vehicleName.trim());
    return { clientId: client.id, vehicleId: vehicle.id };
  }

  /** Car or motorcycle: from the vehicle file, else from the brand */
  kindOf(clientName: string, vehicleName: string): VehicleKind {
    return this.vehicleOf(clientName, vehicleName)?.kind ?? this.defaultKind(vehicleName);
  }

  /** Car or motorcycle, from the brand when known */
  private defaultKind(name: string): VehicleKind {
    return this.brands.brandOf(name)?.kind === 'motorcycle' ? 'motorcycle' : 'car';
  }

  private patch(id: string, fn: (client: Client) => Client): void {
    this.untouched.delete(id);
    this._clients.update((list) => list.map((client) => (client.id === id ? fn(client) : client)));
  }
}
