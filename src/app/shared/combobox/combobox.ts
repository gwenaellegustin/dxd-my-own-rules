import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../icon/icon';

let nextId = 0;

/**
 * Select field that also accepts free text ("editable combobox").
 * - Typing filters the suggestions; any text is accepted as value.
 * - The chevron (or Alt+↓) shows every suggestion.
 * - ↑ / ↓ move in the list, Enter picks, Escape closes.
 */
@Component({
  selector: 'app-combobox',
  imports: [TranslatePipe, Icon],
  templateUrl: './combobox.html',
  styleUrl: './combobox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Combobox {
  readonly value = input('');
  readonly options = input<string[]>([]);
  readonly valueChange = output<string>();

  protected readonly listId = `combobox-list-${nextId++}`;
  protected readonly open = signal(false);
  /** When false, the list shows every option (opened with the chevron) */
  protected readonly filtering = signal(false);
  protected readonly activeIndex = signal(-1);

  protected readonly filtered = computed(() => {
    const query = this.value().trim().toLowerCase();
    if (!this.filtering() || !query) return this.options();
    return this.options().filter((option) => option.toLowerCase().includes(query));
  });

  protected onInput(text: string): void {
    this.valueChange.emit(text);
    this.filtering.set(true);
    this.activeIndex.set(-1);
    this.open.set(true);
  }

  protected toggle(input: HTMLInputElement): void {
    this.filtering.set(false);
    this.activeIndex.set(-1);
    this.open.update((open) => !open);
    input.focus();
  }

  protected select(option: string): void {
    this.valueChange.emit(option);
    this.close();
  }

  protected close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.filtered().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) {
          this.filtering.set(!event.altKey);
          this.open.set(true);
        }
        if (count) this.activeIndex.update((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.activeIndex.update((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case 'Enter':
        if (this.open() && this.activeIndex() >= 0) {
          event.preventDefault();
          this.select(this.filtered()[this.activeIndex()]);
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        break;
    }
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }
}
