export interface TranscriptMessage {
  id: string;
  /** User who sent the message (User.id). Absent for replies from the assistant. */
  userId?: string;
  text: string;
  /** ISO date-time */
  timestamp: string;
  /** Worksheet the message relates to, if any */
  worksheetId?: string;
}
