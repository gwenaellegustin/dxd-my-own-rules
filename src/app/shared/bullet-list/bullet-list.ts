import { Directive, ElementRef, inject } from '@angular/core';

export const BULLET = '• ';

/**
 * Turns a <textarea> into a bulleted list: every line starts with "• ".
 * - Typing in an empty field or pasting text adds the bullets automatically.
 * - Enter starts a new bullet.
 * - Backspace right after an empty bullet removes it.
 * Every change dispatches an `input` event so (input) handlers and AutoGrow stay in sync.
 */
@Directive({
  selector: 'textarea[appBulletList]',
  host: {
    '(keydown.enter)': 'newBullet($event)',
    '(keydown.backspace)': 'removeEmptyBullet($event)',
    '(input)': 'normalize()',
  },
})
export class BulletList {
  private readonly textarea = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;

  protected newBullet(event: Event): void {
    event.preventDefault();
    this.replaceSelection(`\n${BULLET}`);
  }

  protected removeEmptyBullet(event: Event): void {
    const el = this.textarea;
    const caret = el.selectionStart;
    if (caret !== el.selectionEnd) return;
    const lineStart = el.value.lastIndexOf('\n', caret - 1) + 1;
    if (el.value.slice(lineStart, caret) !== BULLET) return;
    event.preventDefault();
    // Remove the bullet, and the line break before it when it is not the first line
    const from = lineStart > 0 ? lineStart - 1 : lineStart;
    this.update(el.value.slice(0, from) + el.value.slice(caret), from);
  }

  /** Adds the missing bullet to every non-empty line, keeping the caret in place */
  protected normalize(): void {
    const el = this.textarea;
    let caret = el.selectionStart;
    let offset = 0;
    const lines = el.value.split('\n').map((line) => {
      const start = offset;
      offset += line.length + 1;
      if (line === '' || line.startsWith(BULLET.trim())) return line;
      if (start < caret) caret += BULLET.length;
      return BULLET + line;
    });
    const value = lines.join('\n');
    if (value !== el.value) this.update(value, caret);
  }

  private replaceSelection(text: string): void {
    const el = this.textarea;
    const start = el.selectionStart;
    this.update(el.value.slice(0, start) + text + el.value.slice(el.selectionEnd), start + text.length);
  }

  private update(value: string, caret: number): void {
    const el = this.textarea;
    el.value = value;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
