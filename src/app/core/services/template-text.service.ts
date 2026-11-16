import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Language, SUPPORTED_LANGUAGES } from './language.service';

const CUSTOM_PREFIX = 'custom.';

/**
 * Texts of the worksheet template (titles, options, labels…) edited on the settings page, in
 * every language at once. The template refers to texts by translation key: an edited text is
 * written into the translations (in memory, like the rest of the prototype), so every page shows
 * it at once. A key of the i18n files can be shared (e.g. "Front" / "Rear"): it is first copied
 * to a new `custom.*` key, so editing one line never changes another one.
 */
@Injectable({ providedIn: 'root' })
export class TemplateTextService {
  private readonly translate = inject(TranslateService);

  /** Changes each time a text is edited (to refresh the inputs) */
  readonly version = signal(0);

  /** Loads the languages not used yet (their texts are shown side by side) */
  load(): void {
    for (const lang of SUPPORTED_LANGUAGES) {
      if (Object.keys(this.translate.getTranslations(lang) ?? {}).length === 0) {
        this.translate.reloadLang(lang).subscribe(() => this.version.update((v) => v + 1));
      }
    }
  }

  text(key: string | undefined, lang: Language): string {
    this.version();
    if (!key) return '';
    const value = this.translate.instant(key, undefined, lang);
    return typeof value === 'string' && value !== key ? value : '';
  }

  /** Sets the text of `key` in `lang`; returns the key to keep (a new one for a shared key) */
  edit(key: string | undefined, lang: Language, value: string): string {
    let target = key;
    if (!target?.startsWith(CUSTOM_PREFIX)) {
      target = `${CUSTOM_PREFIX}${crypto.randomUUID().slice(0, 8)}`;
      for (const other of SUPPORTED_LANGUAGES) this.set(target, other, this.text(key, other));
    }
    this.set(target, lang, value);
    this.version.update((v) => v + 1);
    return target;
  }

  /** New text key with the same text in every language */
  create(value = ''): string {
    const key = `${CUSTOM_PREFIX}${crypto.randomUUID().slice(0, 8)}`;
    for (const lang of SUPPORTED_LANGUAGES) this.set(key, lang, value);
    return key;
  }

  private set(key: string, lang: Language, value: string): void {
    // "custom.abc" → { custom: { abc: value } }, merged into the language
    const nested = key
      .split('.')
      .reduceRight<Record<string, unknown>>((inner, part, i, parts) => (i === parts.length - 1 ? { [part]: value } : { [part]: inner }), {});
    this.translate.setTranslation(lang, nested as never, true);
  }
}
