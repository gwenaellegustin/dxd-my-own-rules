import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon, IconName } from '../../../shared/icon/icon';
import { AutoGrow } from '../../../shared/auto-grow/auto-grow';
import { Damage, DamageType, Worksheet } from '../../../core/models/worksheet.model';

type EditableField = 'client' | 'vehicle' | 'date' | 'kilometers' | 'hours' | 'comments';

interface DamageLegend {
  type: DamageType;
  labelKey: string;
  icon: IconName | null; // bump is drawn in CSS (circle)
}

/** Top of the work area: general information + damage diagram. */
@Component({
  selector: 'app-worksheet-details',
  imports: [RouterLink, TranslatePipe, Icon, AutoGrow],
  templateUrl: './worksheet-details.html',
  styleUrl: './worksheet-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetDetails {
  readonly worksheet = input.required<Worksheet>();
  readonly fieldChange = output<Partial<Pick<Worksheet, EditableField>>>();
  readonly damageAdd = output<Damage>();
  readonly damageRemove = output<number>();

  protected readonly legend: DamageLegend[] = [
    { type: 'bump', labelKey: 'damage.bump', icon: null },
    { type: 'scratch', labelKey: 'damage.scratch', icon: 'damage-scratch' },
    { type: 'impact', labelKey: 'damage.impact', icon: 'damage-impact' },
  ];

  /** Damage type selected in the legend; clicking the diagram then places a marker */
  protected readonly activeDamage = signal<DamageType | null>(null);

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

  protected iconOf(type: DamageType): IconName | null {
    return this.legend.find((item) => item.type === type)?.icon ?? null;
  }
}
