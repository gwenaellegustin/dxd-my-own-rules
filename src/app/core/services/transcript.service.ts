import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { TranscriptMessage } from '../models/transcript.model';
import { readPreference, writePreference } from '../utils/local-storage';
import { LanguageService } from './language.service';

const WIDTH_KEY = 'transcriptWidth';

@Injectable({ providedIn: 'root' })
export class TranscriptService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);

  readonly messages = toSignal(this.api.get<TranscriptMessage[]>(API_ENDPOINTS.transcripts), {
    initialValue: [] as TranscriptMessage[],
  });

  /** Text of a message in the language of the app (else in English, else in the first one given) */
  text(message: TranscriptMessage): string {
    const text = message.text;
    if (typeof text === 'string') return text;
    return text[this.language.current() ?? ''] ?? text['en'] ?? Object.values(text)[0] ?? '';
  }

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
  readonly width = signal<number | null>(Number(readPreference(WIDTH_KEY)) || null);

  /** `null`: back to the default width */
  setWidth(width: number | null): void {
    const rounded = width === null ? null : Math.round(width);
    this.width.set(rounded);
    writePreference(WIDTH_KEY, rounded === null ? null : String(rounded));
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
