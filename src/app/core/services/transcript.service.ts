import { Injectable, inject } from '@angular/core';
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
}
