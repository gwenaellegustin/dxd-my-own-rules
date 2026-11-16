import { InvoiceUnit } from './invoice.model';
import { VehicleKind } from './vehicle-brand.model';
import { LineState } from './worksheet.model';

/**
 * The worksheet template describes WHICH lines a worksheet contains
 * (Labour, Parts, Fluids, Various...). It is configuration data served by
 * the API; labels are translation keys so the template is language agnostic.
 */

export type LineFieldType =
  | 'text' // short text input
  | 'number' // short numeric input
  | 'date' // date picker
  | 'radio' // 0 or 1 choice among options (clicking the selected one clears it)
  | 'checkbox' // multiple choice among options
  | 'label' // static text between inputs (e.g. "... new tyres")
  | 'textarea'; // free text taking the full line ("Other")

export interface LineFieldOption {
  value: string;
  labelKey: string;
}

export interface LineField {
  id: string;
  type: LineFieldType;
  labelKey?: string;
  placeholderKey?: string;
  /** Visual width of inputs: small (120px), medium (200px) or full */
  size?: 'small' | 'medium' | 'full';
  options?: LineFieldOption[];
}

export interface TemplateLine {
  id: string;
  /** Absent for free-text lines that only contain a textarea */
  titleKey?: string;
  /**
   * The line can be filled several times ("Other"): as soon as the last one is filled,
   * a new empty one is added under it. Instances are stored as `id`, `id~2`, `id~3`…
   */
  repeatable?: boolean;
  /** Inputs shown on the same row as the title */
  fields?: LineField[];
  /** Inputs shown on a second row under the title ("Details" slot) */
  details?: LineField[];
}

export interface TemplateSection {
  id: string;
  titleKey: string;
  /** How the items of this section are counted on the invoice (hours, pieces…) */
  invoiceUnit: InvoiceUnit;
  lines: TemplateLine[];
}

/** Lines of the worksheets of one kind of vehicle (car, motorcycle) */
export interface WorksheetTemplate {
  kind: VehicleKind;
  sections: TemplateSection[];
  /** State of the lines of a new worksheet (planned, values…), keyed like Worksheet.lines */
  defaults: Record<string, LineState>;
}

/**
 * Planning rule: when the line `lineId` is planned (and, with `fieldId`, its field has one of
 * `values`), the lines `plan` are planned too. Applied when the line is edited.
 */
export interface PlanningRule {
  id: string;
  kind: VehicleKind;
  lineId: string;
  fieldId?: string;
  values?: string[];
  plan: string[];
}

/** Worksheet settings (`worksheet-settings.json`) */
export interface WorksheetSettings {
  templates: WorksheetTemplate[];
  rules: PlanningRule[];
}
