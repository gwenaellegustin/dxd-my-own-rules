import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Icon, IconName } from '../icon/icon';
import { VehicleKind } from '../../core/models/client.model';
import { VehicleBrandService } from '../../core/services/vehicle-brand.service';

/**
 * Brand logo of a vehicle (free text, e.g. "VW Golf"), drawn in the current text color.
 * Unknown brand: the vehicle on the lift when `lifted` (work in progress), else a car or a
 * motorcycle (`kind` of the vehicle file, else of the brand).
 */
@Component({
  selector: 'app-vehicle-logo',
  imports: [Icon],
  template: `
    @if (logo(); as url) {
      <span class="logo" [style.mask-image]="'url(' + url + ')'"></span>
    } @else {
      <app-icon [name]="fallbackIcon()" size="xlarge" />
    }
  `,
  styles: `
    :host {
      flex: none;
      display: inline-flex;
    }

    // Monochrome logo drawn in the current color, like the icons
    .logo {
      width: var(--icon-size-xlarge);
      height: var(--icon-size-xlarge);
      background-color: currentColor;
      mask: center / contain no-repeat;
    }
  `,
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleLogo {
  private readonly brands = inject(VehicleBrandService);

  readonly vehicle = input.required<string>();
  readonly lifted = input(false);
  /** Car or motorcycle, when the vehicle file is known */
  readonly kind = input<VehicleKind | undefined>(undefined);

  private readonly brand = computed(() => this.brands.brandOf(this.vehicle()));
  protected readonly logo = computed(() => this.brand()?.logo);
  protected readonly fallbackIcon = computed<IconName>(() =>
    this.lifted() ? 'lift' : (this.kind() ?? this.brand()?.kind) === 'motorcycle' ? 'motorcycle' : 'car',
  );
}
