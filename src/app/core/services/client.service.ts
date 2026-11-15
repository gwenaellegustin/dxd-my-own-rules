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

  /** Vehicles of the given client, or every known vehicle when the client is unknown */
  vehiclesFor(clientName: string): string[] {
    const name = clientName.trim().toLowerCase();
    const client = this.clients().find((c) => c.name.toLowerCase() === name);
    const vehicles = client ? client.vehicles : this.clients().flatMap((c) => c.vehicles);
    return [...new Set(vehicles)].sort((a, b) => a.localeCompare(b));
  }
}
