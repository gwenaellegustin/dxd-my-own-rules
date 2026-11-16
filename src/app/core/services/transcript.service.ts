import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { TranscriptMessage } from '../models/transcript.model';

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
