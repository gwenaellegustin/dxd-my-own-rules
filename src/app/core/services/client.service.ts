import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { Client } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly api = inject(ApiService);

  readonly clients = toSignal(this.api.get<Client[]>(API_ENDPOINTS.clients), { initialValue: [] as Client[] });

  readonly clientNames = computed(() => this.clients().map((client) => client.name));

  /** Vehicle names of the given client, or every known vehicle when the client is unknown */
  vehiclesFor(clientName: string): string[] {
    const client = this.byName(clientName);
    const vehicles = client ? client.vehicles : this.clients().flatMap((c) => c.vehicles);
    return [...new Set(vehicles.map((vehicle) => vehicle.name))].sort((a, b) => a.localeCompare(b));
  }

  /** Licence plate of a client's vehicle; empty when the vehicle is not known */
  plateOf(clientName: string, vehicleName: string): string {
    const name = vehicleName.trim().toLowerCase();
    return this.byName(clientName)?.vehicles.find((vehicle) => vehicle.name.toLowerCase() === name)?.plate ?? '';
  }

  /** Client with this name (worksheets refer to clients by name), if known */
  byName(clientName: string): Client | undefined {
    const name = clientName.trim().toLowerCase();
    return this.clients().find((client) => client.name.toLowerCase() === name);
  }
}
