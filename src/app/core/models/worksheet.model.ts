/** open: work in progress → invoiced: its invoice exists (open, sent or paid) */
export type WorksheetStatus = 'open' | 'invoiced';

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
  /** Photo of the vehicle registration document (carte grise), or null when none */
  registrationImage: string | null;
  /** Note about the registration document */
  registrationNote: string;
  /** ISO date (yyyy-MM-dd) or null when not scheduled yet */
  date: string | null;
  kilometers: string;
  hours: string;
  comments: string;
  damages: Damage[];
  /** Keyed by TemplateLine.id */
  lines: Record<string, LineState>;
  /** Line keys planned but not done, to carry over to the next intervention (set when invoicing) */
  carryOver?: string[];
}

export const emptyLineState = (): LineState => ({
  planned: false,
  done: false,
  note: '',
  values: {},
});

/** True when at least one field of the line holds a value (text, option…) */
export const hasLineValues = (state: LineState): boolean =>
  Object.values(state.values).some((value) => (Array.isArray(value) ? value.length > 0 : !!value));
