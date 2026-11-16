import { InvoiceUnit } from './invoice.model';
import { VehicleKind } from './vehicle-brand.model';

/**
 * The worksheet template describes WHICH lines a worksheet contains
 * (Labour, Parts, Fluids, Various...). It is configuration data served by
 * the API; labels are translation keys so the template is language agnostic.
 */

export type LineFieldType =
  | 'text' // text input that grows with its content (wider, then on several rows)
  | 'date' // date picker
  | 'radio' // 0 or 1 choice among options (clicking the selected one clears it)
  | 'checkbox' // multiple choice among options
  | 'label'; // static text between inputs (e.g. "... new tyres")

export interface LineFieldOption {
  value: string;
  labelKey: string;
}

export interface LineField {
  id: string;
  type: LineFieldType;
  labelKey?: string;
  placeholderKey?: string;
  /** Minimum width of text inputs: small (120px), medium (200px) or full (the rest of the row) */
  size?: 'small' | 'medium' | 'full';
  options?: LineFieldOption[];
}

export interface TemplateLine {
  id: string;
  /** Absent for free-text lines that only contain a full-width text field ("Other") */
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
}

/**
 * Planning rule: when the line `lineId` is planned (or done, see `status`) and, with `fieldId`,
 * its field has one of `values`, the lines `plan` are planned (or done) too. Applied when the line
 * is edited.
 */
export type RuleStatus = 'planned' | 'done';

export interface PlanningRule {
  id: string;
  kind: VehicleKind;
  /** State that triggers the rule, and that it gives to the lines `plan` (default: planned) */
  status?: RuleStatus;
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
