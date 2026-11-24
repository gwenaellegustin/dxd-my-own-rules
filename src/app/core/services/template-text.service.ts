import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Language, SUPPORTED_LANGUAGES } from './language.service';
import { UndoService } from './undo.service';

const CUSTOM_PREFIX = 'custom.';

/** Edited texts by language: `custom` part of the translations ({"abc":"Front"} for custom.abc), as JSON */
type CustomTexts = Partial<Record<Language, string>>;

/**
 * Texts of the worksheet template (titles, options, labels…) edited on the settings page, in
 * every language at once. The template refers to texts by translation key: an edited text is
 * written into the translations (in memory, like the rest of the prototype), so every page shows
 * it at once. A key of the i18n files can be shared (e.g. "Front" / "Rear"): it is first copied
 * to a new `custom.*` key, so editing one line never changes another one.
 * The edited texts are kept in the undo history with the settings that use them (see UndoService).
 */
@Injectable({ providedIn: 'root' })
export class TemplateTextService {
  private readonly translate = inject(TranslateService);
  private readonly history = inject(UndoService);

  /** Changes each time a text is edited (to refresh the inputs) */
  readonly version = signal(0);

  constructor() {
    const customTexts = (lang: Language) => JSON.stringify(this.translate.getTranslations(lang)?.['custom'] ?? {});
    this.history.track<CustomTexts>({
      get: () => Object.fromEntries(SUPPORTED_LANGUAGES.map((lang) => [lang, customTexts(lang)])),
      // Only the languages whose texts changed (a language not loaded yet is left alone)
      set: (texts) => {
        for (const lang of SUPPORTED_LANGUAGES) {
          const translations = this.translate.getTranslations(lang);
          const saved = texts[lang] ?? '{}';
          if (!translations || saved === customTexts(lang)) continue;
          this.translate.setTranslation(lang, { ...translations, custom: JSON.parse(saved) }, false);
        }
        this.version.update((v) => v + 1);
      },
    });
  }

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
    this.history.record();
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
    this.history.record();
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
