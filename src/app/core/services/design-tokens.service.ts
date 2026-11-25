import { Injectable, computed, signal } from '@angular/core';
import { readPreference, writePreference } from '../utils/local-storage';

export type TokenGroup =
  'colors' | 'typography' | 'radius' | 'spacing' | 'effects' | 'sizes' | 'layers';

export interface DesignToken {
  /** CSS custom property, e.g. `--color-on-background` */
  name: string;
  group: TokenGroup;
  /** Value of _tokens.scss */
  defaultValue: string;
  /** Made from other tokens (e.g. a status background mixed from its colour): not edited directly */
  derived: boolean;
}

/** Order of the groups in the design system page */
export const TOKEN_GROUPS: TokenGroup[] = [
  'colors',
  'typography',
  'radius',
  'spacing',
  'effects',
  'sizes',
  'layers',
];

/** Group of a token, from its name (the rest are sizes) */
const GROUP_PATTERNS: [TokenGroup, RegExp][] = [
  ['colors', /^--color-/],
  ['typography', /^--(font|line-height)-/],
  ['radius', /^--radius-/],
  ['spacing', /^--space-/],
  ['effects', /^--(stroke|opacity|shadow|overlay)-/],
  ['layers', /^--z-/],
];

/** Tokens left out of the design system page (motion and shadows: not documented there for now) */
const HIDDEN = /^--(transition|shadow)-/;

const STORAGE_KEY = 'design-tokens';

/**
 * Design tokens of the app (the custom properties of `:root`, see _tokens.scss) and the values
 * changed in the design system page. A changed value is set on <html>, so the whole app follows
 * it at once; the changes are kept in this browser only, until they are copied into _tokens.scss.
 */
@Injectable({ providedIn: 'root' })
export class DesignTokensService {
  private readonly root = document.documentElement;
  private tokenList?: DesignToken[];

  /** Changed values, by token name */
  readonly overrides = signal<Record<string, string>>({});
  readonly changedCount = computed(() => Object.keys(this.overrides()).length);

  constructor() {
    // Only the tokens that still exist and can be edited (a token renamed or made derived since
    // the change was saved is dropped)
    const saved = loadOverrides();
    const editable = new Set(this.tokens.filter((t) => !t.derived).map((t) => t.name));
    const kept = editable.size
      ? Object.fromEntries(Object.entries(saved).filter(([name]) => editable.has(name)))
      : saved;
    this.save(kept);
  }

  /** Every token, in the order of _tokens.scss (read from the global stylesheet) */
  get tokens(): DesignToken[] {
    if (!this.tokenList?.length) this.tokenList = readTokens();
    return this.tokenList;
  }

  value(token: DesignToken): string {
    return this.overrides()[token.name] ?? token.defaultValue;
  }

  isChanged(token: DesignToken): boolean {
    return token.name in this.overrides();
  }

  /** Empty or default value: back to the value of _tokens.scss */
  set(token: DesignToken, value: string): void {
    if (token.derived) return;
    const next = { ...this.overrides() };
    value = value.trim();
    if (!value || value === token.defaultValue) delete next[token.name];
    else next[token.name] = value;
    this.save(next);
  }

  reset(token: DesignToken): void {
    this.set(token, '');
  }

  resetAll(): void {
    this.save({});
  }

  /** The changed tokens, as lines to paste into _tokens.scss */
  changesAsCss(): string {
    return Object.entries(this.overrides())
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n');
  }

  private save(next: Record<string, string>): void {
    const previous = this.overrides();
    this.overrides.set(next);
    this.apply(next, previous);
    writePreference(STORAGE_KEY, Object.keys(next).length ? JSON.stringify(next) : null);
  }

  private apply(next: Record<string, string>, previous: Record<string, string>): void {
    for (const name of Object.keys(previous)) {
      if (!(name in next)) this.root.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(next)) this.root.style.setProperty(name, value);
  }
}

function loadOverrides(): Record<string, string> {
  try {
    const saved = JSON.parse(readPreference(STORAGE_KEY) ?? '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

/** Custom properties of the `:root` rules of the stylesheets (the inline changes are not read) */
function readTokens(): DesignToken[] {
  const values = new Map<string, string>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // stylesheet of another origin (Google Fonts): not readable
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule) || rule.selectorText !== ':root') continue;
      for (let i = 0; i < rule.style.length; i++) {
        const name = rule.style[i];
        if (name.startsWith('--') && !HIDDEN.test(name)) {
          values.set(name, rule.style.getPropertyValue(name).trim());
        }
      }
    }
  }
  return [...values].map(([name, defaultValue]) => ({
    name,
    defaultValue,
    group: GROUP_PATTERNS.find(([, pattern]) => pattern.test(name))?.[0] ?? 'sizes',
    derived: defaultValue.includes('var(--'),
  }));
}
