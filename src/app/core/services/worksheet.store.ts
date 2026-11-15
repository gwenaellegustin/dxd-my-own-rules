import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { WorksheetTemplate } from '../models/worksheet-template.model';
import {
  Damage,
  LineState,
  Worksheet,
  WorksheetStatus,
  emptyLineState,
} from '../models/worksheet.model';

/**
 * Holds the worksheets and the worksheet template in memory.
 * Edits are kept client-side for the prototype; replace the `update*`
 * methods with API calls once a backend exists.
 */
@Injectable({ providedIn: 'root' })
export class WorksheetStore {
  private readonly api = inject(ApiService);

  private readonly _worksheets = signal<Worksheet[]>([]);
  private readonly _template = signal<WorksheetTemplate | null>(null);
  private readonly _loaded = signal(false);

  readonly worksheets = this._worksheets.asReadonly();
  readonly template = this._template.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly byStatus = computed(() => {
    const groups: Record<WorksheetStatus, Worksheet[]> = { open: [], toBeBilled: [], invoiced: [] };
    for (const worksheet of this._worksheets()) groups[worksheet.status].push(worksheet);
    return groups;
  });

  load(): void {
    if (this._loaded()) return;
    forkJoin({
      template: this.api.get<WorksheetTemplate>(API_ENDPOINTS.worksheetTemplate),
      worksheets: this.api.get<Worksheet[]>(API_ENDPOINTS.worksheets),
    }).subscribe(({ template, worksheets }) => {
      this._template.set(template);
      this._worksheets.set(worksheets);
      this._loaded.set(true);
    });
  }

  getById(id: string | null): Worksheet | undefined {
    return this._worksheets().find((worksheet) => worksheet.id === id);
  }

  create(): Worksheet {
    const worksheet: Worksheet = {
      id: crypto.randomUUID(),
      status: 'open',
      client: '',
      vehicle: '',
      date: new Date().toISOString().slice(0, 10),
      kilometers: '',
      hours: '',
      comments: '',
      damages: [],
      lines: {},
    };
    this._worksheets.update((list) => [worksheet, ...list]);
    return worksheet;
  }

  update(id: string, changes: Partial<Omit<Worksheet, 'id' | 'lines'>>): void {
    this.patch(id, (worksheet) => ({ ...worksheet, ...changes }));
  }

  updateLine(id: string, lineId: string, changes: Partial<LineState>): void {
    this.patch(id, (worksheet) => ({
      ...worksheet,
      lines: {
        ...worksheet.lines,
        [lineId]: { ...this.lineState(worksheet, lineId), ...changes },
      },
    }));
  }

  addDamage(id: string, damage: Damage): void {
    this.patch(id, (worksheet) => ({ ...worksheet, damages: [...worksheet.damages, damage] }));
  }

  removeDamage(id: string, index: number): void {
    this.patch(id, (worksheet) => ({
      ...worksheet,
      damages: worksheet.damages.filter((_, i) => i !== index),
    }));
  }

  lineState(worksheet: Worksheet, lineId: string): LineState {
    return worksheet.lines[lineId] ?? emptyLineState();
  }

  private patch(id: string, fn: (worksheet: Worksheet) => Worksheet): void {
    this._worksheets.update((list) => list.map((worksheet) => (worksheet.id === id ? fn(worksheet) : worksheet)));
  }
}
