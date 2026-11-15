import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { VehicleBrand } from '../models/vehicle-brand.model';

@Injectable({ providedIn: 'root' })
export class VehicleBrandService {
  private readonly api = inject(ApiService);

  readonly brands = toSignal(this.api.get<VehicleBrand[]>(API_ENDPOINTS.vehicleBrands), {
    initialValue: [] as VehicleBrand[],
  });

  /** Brand found in a free-text vehicle ("VW Golf" → Volkswagen), or null */
  brandOf(vehicle: string): VehicleBrand | null {
    const words = ` ${vehicle.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
    return this.brands().find((brand) => brand.aliases.some((alias) => words.includes(` ${alias} `))) ?? null;
  }
}
