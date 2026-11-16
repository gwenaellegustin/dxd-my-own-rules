import { Injectable, inject, signal } from '@angular/core';
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
}
