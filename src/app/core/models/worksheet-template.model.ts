/**
 * The worksheet template describes WHICH lines a worksheet contains
 * (Labour, Parts, Fluids, Various...). It is configuration data served by
 * the API; labels are translation keys so the template is language agnostic.
 */

export type LineFieldType =
  | 'text' // short text input
  | 'number' // short numeric input
  | 'date' // date picker
  | 'radio' // single choice among options
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
  /** Round checkboxes look like radios (design "Small / Medium / Big") */
  round?: boolean;
  options?: LineFieldOption[];
}

export interface TemplateLine {
  id: string;
  /** Absent for free-text lines that only contain a textarea */
  titleKey?: string;
  /** Inputs shown on the same row as the title */
  fields?: LineField[];
  /** Inputs shown on a second row under the title ("Details" slot) */
  details?: LineField[];
}

export interface TemplateSection {
  id: string;
  titleKey: string;
  lines: TemplateLine[];
}

export interface WorksheetTemplate {
  sections: TemplateSection[];
}
