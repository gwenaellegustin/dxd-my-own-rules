/** Worksheet or invoice changed by the assistant */
export interface TranscriptTarget {
  type: 'worksheet' | 'invoice';
  id: string;
}

/**
 * One change made by the assistant from what it understood of the last transcript.
 * `area` is the element changed on the target page (its `data-area` attribute: "hours",
 * "line:engineOil", "item:brakeFluid"…), highlighted when the change is clicked.
 */
export interface TranscriptChange {
  target: TranscriptTarget;
  area: string;
  /** Translation key of the changed field or line */
  labelKey: string;
  /** Values as text; empty = nothing before / nothing after */
  before: string;
  after: string;
  /** Lines: Planned / Done before and after the change (none = neither) */
  statusBefore?: LineStatus;
  statusAfter?: LineStatus;
}

export type LineStatus = 'planned' | 'done';

export interface TranscriptMessage {
  id: string;
  /** User who sent the message (User.id). Absent for replies from the assistant. */
  userId?: string;
  text: string;
  /** ISO date-time */
  timestamp: string;
  /** Worksheet the message relates to, if any */
  worksheetId?: string;
  /** Assistant replies: what was changed, with the previous and new values */
  changes?: TranscriptChange[];
}
