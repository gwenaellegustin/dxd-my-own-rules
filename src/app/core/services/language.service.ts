import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'greasy-notes.language';
const DEFAULT_LANGUAGE: Language = 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  readonly languages = SUPPORTED_LANGUAGES;
  readonly current = this.translate.currentLang;

  /** English by default; French only when the user picked it (remembered locally) */
  init(): void {
    this.use(this.storedLanguage() ?? DEFAULT_LANGUAGE);
  }

  use(language: Language): void {
    this.translate.use(language);
    this.document.documentElement.lang = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // storage unavailable (private mode…): the choice simply isn't remembered
    }
  }

  private storedLanguage(): Language | null {
    try {
      return this.asSupported(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  private asSupported(value: string | null): Language | null {
    return SUPPORTED_LANGUAGES.find((language) => language === value) ?? null;
  }
}
