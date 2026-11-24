import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { TemplateTextService } from '../../../core/services/template-text.service';
import { Language, SUPPORTED_LANGUAGES } from '../../../core/services/language.service';

/**
 * One text of the template in every language, side by side (FR | EN).
 * Emits the key to keep: a shared key becomes a new one on the first edit.
 */
@Component({
  selector: 'app-text-key-input',
  imports: [UpperCasePipe],
  template: `
    @for (lang of languages; track lang) {
      <label class="text">
        <span class="text__lang" aria-hidden="true">{{ lang | uppercase }}</span>
        <input
          class="input"
          type="text"
          [attr.lang]="lang"
          [attr.aria-label]="label() + ' (' + (lang | uppercase) + ')'"
          [placeholder]="placeholder()"
          [value]="texts.text(key(), lang)"
          (input)="edit(lang, $event)"
        />
      </label>
    }
  `,
  styles: `
    :host {
      flex: 1;
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(var(--text-key-min-width), 1fr));
      gap: var(--space-200);
    }

    .text {
      position: relative;
      display: flex;
      min-width: 0;
    }

    // Language code inside the field, on the left
    .text__lang {
      position: absolute;
      top: 50%;
      left: var(--space-200);
      transform: translateY(-50%);
      font-size: var(--font-size-small);
      color: var(--color-on-background-faint);
      pointer-events: none;
    }

    .input {
      padding-left: calc(var(--space-200) + var(--space-800));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextKeyInput {
  protected readonly texts = inject(TemplateTextService);
  protected readonly languages: readonly Language[] = [...SUPPORTED_LANGUAGES].sort((a) => (a === 'fr' ? -1 : 1));

  readonly key = input<string | undefined>();
  /** Accessible name of the inputs */
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly keyChange = output<string>();

  protected edit(lang: Language, event: Event): void {
    const key = this.texts.edit(this.key(), lang, (event.target as HTMLInputElement).value);
    if (key !== this.key()) this.keyChange.emit(key);
  }
}
