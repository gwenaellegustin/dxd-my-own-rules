import { VehicleKind } from './vehicle-brand.model';

/** open: work in progress → invoiced: its invoice exists (open, sent or paid) */
export type WorksheetStatus = 'open' | 'invoiced';

export type LineFieldValue = string | string[] | null;

/** State of one template line inside a given worksheet */
export interface LineState {
  planned: boolean;
  done: boolean;
  note: string;
  values: Record<string, LineFieldValue>;
  /** Quantity used, as typed ("3.5", "3,5"): lines of the sections counted in litres (fluids) */
  quantity?: string;
}

export type DamageType = 'bump' | 'scratch' | 'impact';

export interface Damage {
  type: DamageType;
  /** Position on the car diagram, in % of its width / height */
  x: number;
  y: number;
}

export interface Worksheet {
  id: string;
  status: WorksheetStatus;
  /** Which template (lines) the worksheet uses */
  kind: VehicleKind;
  client: string;
  vehicle: string;
  /** ISO date (yyyy-MM-dd) or null when not scheduled yet */
  date: string | null;
  kilometers: string;
  hours: string;
  comments: string;
  damages: Damage[];
  /** Keyed by TemplateLine.id */
  lines: Record<string, LineState>;
  /**
   * Line keys planned but not done, to carry over to the next intervention (set when invoicing).
   * A key is removed once imported into a later worksheet of the vehicle, or deleted.
   */
  carryOver?: string[];
}

/** One carried-over line: `key` in the worksheet `sourceId` */
export interface CarryOverRef {
  sourceId: string;
  key: string;
}

export const emptyLineState = (): LineState => ({
  planned: false,
  done: false,
  note: '',
  values: {},
});

/** True when at least one field of the line holds a value (text, option…) or its quantity is filled */
export const hasLineValues = (state: LineState): boolean =>
  !!state.quantity?.trim() ||
  Object.values(state.values).some((value) => (Array.isArray(value) ? value.length > 0 : !!value));

/** Typed quantity as a number ("3,5" → 3.5); null when empty or not a positive number */
export const parseQuantity = (quantity: string | undefined): number | null => {
  const value = Number((quantity ?? '').trim().replace(',', '.'));
  return quantity?.trim() && Number.isFinite(value) && value > 0 ? value : null;
};
