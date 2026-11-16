import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { TranscriptMessage } from '../models/transcript.model';

const WIDTH_KEY = 'garage.transcriptWidth';

function readWidth(): number | null {
  try {
    const width = Number(localStorage.getItem(WIDTH_KEY));
    return width > 0 ? width : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class TranscriptService {
  private readonly api = inject(ApiService);

  readonly messages = toSignal(this.api.get<TranscriptMessage[]>(API_ENDPOINTS.transcripts), {
    initialValue: [] as TranscriptMessage[],
  });

  /**
   * The panel is open: kept here (not in each page) so it stays open when going from a worksheet
   * to an invoice and back, e.g. after clicking a change of an answer
   */
  readonly open = signal(false);

  /**
   * Scroll position of the panel, kept when another page is opened (each page has its own
   * panel). Null until the panel was scrolled: it then opens on today.
   */
  scrollTop: number | null = null;

  /** Width of the open panel (px) chosen by dragging its edge; null = default width. Remembered. */
  readonly width = signal<number | null>(readWidth());

  setWidth(width: number): void {
    this.width.set(Math.round(width));
    try {
      localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
    } catch {
      // storage unavailable: the width is simply not remembered
    }
  }

  /** Problem answers already seen and validated by the user (kept in memory) */
  private readonly validated = signal<ReadonlySet<string>>(new Set());

  /** Answers the assistant could not apply, not validated yet: counted on a red badge */
  readonly problemCount = computed(() => this.messages().filter((message) => this.isProblem(message)).length);

  isProblem(message: TranscriptMessage): boolean {
    return !!message.problem && !this.validated().has(message.id);
  }

  /** The user has seen that nothing was done: the answer is no longer shown as a problem */
  validate(id: string): void {
    this.validated.update((ids) => new Set([...ids, id]));
  }
}
