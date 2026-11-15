export type WorksheetStatus = 'open' | 'toBeBilled' | 'invoiced';

export type LineFieldValue = string | string[] | null;

/** State of one template line inside a given worksheet */
export interface LineState {
  planned: boolean;
  done: boolean;
  note: string;
  values: Record<string, LineFieldValue>;
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
}

export const emptyLineState = (): LineState => ({
  planned: false,
  done: false,
  note: '',
  values: {},
});
