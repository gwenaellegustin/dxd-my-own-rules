import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { Clearable } from '../../shared/clearable/clearable';
import { TranscriptChange, TranscriptMessage } from '../../core/models/transcript.model';
import { TranscriptChangeCard } from '../transcript-change/transcript-change';
import { DateFilter } from '../../shared/date-filter/date-filter';
import { HighlightService } from '../../core/services/highlight.service';
import { TranscriptService } from '../../core/services/transcript.service';
import { PanelWidthService } from '../../core/services/panel-width.service';
import { PanelResize } from '../../shared/panel-resize/panel-resize';

interface TranscriptDay {
  date: string;
  messages: TranscriptMessage[];
}

/**
 * "Transcript" component set (Default = collapsed, Opened).
 * A user message is what was said; the assistant reply under it lists what was changed from it
 * (previous → new value). Clicking a change opens its worksheet or invoice and highlights the
 * changed element.
 */
@Component({
  selector: 'app-transcript-panel',
  imports: [DatePipe, TranslatePipe, Icon, Clearable, TranscriptChangeCard, DateFilter, PanelResize],
  templateUrl: './transcript-panel.html',
  styleUrl: './transcript-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'open()' },
})
export class TranscriptPanel {
  readonly messages = input.required<TranscriptMessage[]>();
  readonly open = input(false);
  readonly openChange = output<boolean>();
  /** Answers the assistant could not apply (red badge, shown even when the panel is closed) */
  readonly problemCount = input(0);

  private readonly highlight = inject(HighlightService);
  protected readonly transcript = inject(TranscriptService);
  protected readonly widths = inject(PanelWidthService);

  protected readonly query = signal('');

  protected show(change: TranscriptChange): void {
    this.highlight.show(change.target, change.area);
  }

  /** Only the messages of this day (yyyy-MM-dd), chosen with the calendar button */
  protected readonly dateFilter = signal<string | null>(null);

  protected readonly days = computed<TranscriptDay[]>(() => {
    const query = this.query().trim().toLowerCase();
    const date = this.dateFilter();
    const days = new Map<string, TranscriptMessage[]>();
    const sorted = [...this.messages()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const message of sorted) {
      if (query && !this.transcript.text(message).toLowerCase().includes(query)) continue;
      const day = message.timestamp.slice(0, 10);
      if (date && day !== date) continue;
      days.set(day, [...(days.get(day) ?? []), message]);
    }
    // The chosen day, or today, is shown even without message (today: last, the previous above)
    const shown = date ?? this.today;
    if (!query && !days.has(shown)) days.set(shown, []);
    return [...days].map(([day, messages]) => ({ date: day, messages }));
  });


  /** yyyy-MM-dd, local time */
  protected readonly today = new Date().toLocaleDateString('sv');

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // When the panel opens: where it was left (also on another page), else on today (bottom)
    afterRenderEffect(() => {
      const scroller = this.scroller()?.nativeElement;
      if (!scroller) return;
      // Next frame: once the panel has its final size (fonts, layout of the open panel)
      requestAnimationFrame(() => {
        scroller.scrollTop = this.transcript.scrollTop ?? scroller.scrollHeight;
      });
    });
  }
}
