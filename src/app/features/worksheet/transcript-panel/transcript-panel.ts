import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../../shared/icon/icon';
import { TranscriptMessage } from '../../../core/models/transcript.model';

interface TranscriptDay {
  date: string;
  messages: TranscriptMessage[];
}

/** "Transcript" component set (Default = collapsed, Opened). */
@Component({
  selector: 'app-transcript-panel',
  imports: [DatePipe, TranslatePipe, Icon],
  templateUrl: './transcript-panel.html',
  styleUrl: './transcript-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'open()' },
})
export class TranscriptPanel {
  readonly messages = input.required<TranscriptMessage[]>();
  readonly open = input(false);
  readonly openChange = output<boolean>();

  protected readonly query = signal('');

  protected readonly days = computed<TranscriptDay[]>(() => {
    const query = this.query().trim().toLowerCase();
    const days = new Map<string, TranscriptMessage[]>();
    const sorted = [...this.messages()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const message of sorted) {
      if (query && !message.text.toLowerCase().includes(query)) continue;
      const day = message.timestamp.slice(0, 10);
      days.set(day, [...(days.get(day) ?? []), message]);
    }
    return [...days].map(([date, messages]) => ({ date, messages }));
  });
}
