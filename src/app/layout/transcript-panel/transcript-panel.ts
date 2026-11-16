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
import { HighlightService } from '../../core/services/highlight.service';
import { TranscriptService } from '../../core/services/transcript.service';

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
  imports: [DatePipe, TranslatePipe, Icon, Clearable, TranscriptChangeCard],
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

  protected readonly query = signal('');

  /** Drag of the left edge: the panel is on the right, so moving left makes it wider */
  protected startResize(event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement;
    const panel = handle.parentElement!;
    const startX = event.clientX;
    const startWidth = panel.getBoundingClientRect().width;
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
    const move = (e: PointerEvent) => this.transcript.setWidth(this.clamp(panel, startWidth + startX - e.clientX));
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  protected resizeBy(delta: number): void {
    const panel = this.scroller()?.nativeElement.closest<HTMLElement>('.panel');
    if (panel) this.transcript.setWidth(this.clamp(panel, panel.getBoundingClientRect().width + delta));
  }

  protected resetWidth(): void {
    this.transcript.width.set(null);
    try {
      localStorage.removeItem('garage.transcriptWidth');
    } catch {
      // nothing remembered
    }
  }

  /** Between the min / max width tokens */
  private clamp(panel: HTMLElement, width: number): number {
    const style = getComputedStyle(panel);
    const min = parseFloat(style.getPropertyValue('--transcript-min-width')) || 0;
    const max = parseFloat(style.getPropertyValue('--transcript-max-width')) || width;
    return Math.min(max, Math.max(min, width));
  }

  protected show(change: TranscriptChange): void {
    this.highlight.show(change.target, change.area);
  }

  protected readonly days = computed<TranscriptDay[]>(() => {
    const query = this.query().trim().toLowerCase();
    const days = new Map<string, TranscriptMessage[]>();
    const sorted = [...this.messages()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const message of sorted) {
      if (query && !message.text.toLowerCase().includes(query)) continue;
      const day = message.timestamp.slice(0, 10);
      days.set(day, [...(days.get(day) ?? []), message]);
    }
    // Today is always the last day (empty until something is said), the previous ones above it
    if (!query && !days.has(this.today)) days.set(this.today, []);
    return [...days].map(([date, messages]) => ({ date, messages }));
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
