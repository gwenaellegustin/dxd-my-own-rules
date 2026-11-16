import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon, IconName } from '../../../shared/icon/icon';
import { AutoGrow } from '../../../shared/auto-grow/auto-grow';
import { Clearable } from '../../../shared/clearable/clearable';
import { BulletList } from '../../../shared/bullet-list/bullet-list';
import { Combobox } from '../../../shared/combobox/combobox';
import { VehicleDialog } from '../../../shared/vehicle-dialog/vehicle-dialog';
import { ClientService } from '../../../core/services/client.service';
import { isLocked } from '../../../core/services/worksheet.store';
import { Damage, DamageType, Worksheet } from '../../../core/models/worksheet.model';
import { Vehicle } from '../../../core/models/client.model';

type EditableField = 'client' | 'vehicle' | 'date' | 'kilometers' | 'hours' | 'comments';

interface DamageLegend {
  type: DamageType;
  labelKey: string;
  icon: IconName;
}

/** Top of the work area: general information + damage diagram. */
@Component({
  selector: 'app-worksheet-details',
  imports: [TranslatePipe, Icon, AutoGrow, BulletList, Clearable, Combobox, VehicleDialog],
  templateUrl: './worksheet-details.html',
  styleUrl: './worksheet-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetDetails {
  protected readonly clients = inject(ClientService);

  readonly worksheet = input.required<Worksheet>();
  readonly fieldChange = output<Partial<Pick<Worksheet, EditableField>>>();
  readonly damageAdd = output<Damage>();
  readonly damageRemove = output<number>();
  readonly createInvoice = output<void>();
  /** Invoiced worksheet: show its invoice */
  readonly openInvoice = output<void>();
  /** Brand / model changed in the vehicle file: the worksheets of that vehicle follow */
  readonly vehicleRenamed = output<{ from: string; to: string }>();

  protected readonly legend: DamageLegend[] = [
    { type: 'bump', labelKey: 'damage.bump', icon: 'damage-bump' },
    { type: 'scratch', labelKey: 'damage.scratch', icon: 'damage-scratch' },
    { type: 'impact', labelKey: 'damage.impact', icon: 'damage-impact' },
  ];

  /** Damage type selected in the legend; clicking the diagram then places a marker */
  protected readonly activeDamage = signal<DamageType | null>(null);

  /** Invoiced worksheet: read-only (its invoice can still be opened, its vehicle info viewed) */
  protected readonly locked = computed(() => isLocked(this.worksheet()));

  /** Vehicle file shown in the "Vehicle info" dialog (null: closed) */
  protected readonly vehicleRef = signal<{ clientId: string; vehicleId: string } | null>(null);

  /**
   * Vehicle of the open dialog. Without a client (or a vehicle of a locked worksheet that has no
   * file), a read-only draft made from the worksheet.
   */
  protected readonly vehicleFile = computed(() => {
    const ref = this.vehicleRef();
    if (!ref) return null;
    const vehicle = this.clients.getById(ref.clientId)?.vehicles.find((v) => v.id === ref.vehicleId);
    if (vehicle) return { clientId: ref.clientId, vehicle };
    const draft: Vehicle = {
      id: '',
      name: this.worksheet().vehicle,
      plate: '',
      kind: 'car',
      registrationImage: null,
      registrationNote: '',
    };
    return { clientId: '', vehicle: draft };
  });

  /** Opens the vehicle file, created when the worksheet's vehicle is not known yet */
  protected openVehicle(): void {
    const { client, vehicle } = this.worksheet();
    const known = this.clients.vehicleOf(client, vehicle);
    const owner = this.clients.byName(client);
    const ref =
      known && owner
        ? { clientId: owner.id, vehicleId: known.id }
        : this.locked()
          ? null
          : this.clients.ensureVehicle(client, vehicle);
    this.vehicleRef.set(ref ?? { clientId: '', vehicleId: '' });
  }

  protected update(field: EditableField, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.fieldChange.emit({ [field]: field === 'date' ? value || null : value });
  }

  protected toggleDamage(type: DamageType): void {
    this.activeDamage.update((current) => (current === type ? null : type));
  }

  protected placeDamage(event: MouseEvent): void {
    const type = this.activeDamage();
    if (!type) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.damageAdd.emit({
      type,
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  protected iconOf(type: DamageType): IconName {
    return this.legend.find((item) => item.type === type)!.icon;
  }
}
