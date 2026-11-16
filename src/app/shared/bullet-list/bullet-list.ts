import { Directive, ElementRef, inject } from '@angular/core';

export const BULLET = '• ';
/** Typed at the start of a line, turns it into a bullet */
const BULLET_SHORTCUT = '- ';

/**
 * Optional bulleted list in a <textarea> ("Hours", "Comments and tips"): plain text by default,
 * a line becomes a bullet ("• ") only when "- " is typed at its start.
 * - Enter on a bullet line starts a new bullet; Enter on an empty bullet ends the list.
 * - Backspace right after a bullet removes the bullet (the text of the line stays).
 * Every change dispatches an `input` event so (input) handlers and AutoGrow stay in sync.
 */
@Directive({
  selector: 'textarea[appBulletList]',
  host: {
    '(keydown.enter)': 'onEnter($event)',
    '(keydown.backspace)': 'removeBullet($event)',
    '(input)': 'convertShortcut()',
  },
})
export class BulletList {
  private readonly textarea = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;

  protected onEnter(event: Event): void {
    const el = this.textarea;
    if ((event as KeyboardEvent).shiftKey || el.selectionStart !== el.selectionEnd) return;
    const line = this.lineBefore(el.selectionStart);
    if (!line.text.startsWith(BULLET)) return;
    event.preventDefault();
    if (line.text === BULLET) {
      // Empty bullet: end of the list, the bullet is removed
      this.update(el.value.slice(0, line.start) + el.value.slice(el.selectionStart), line.start);
    } else {
      this.replaceSelection(`\n${BULLET}`);
    }
  }

  protected removeBullet(event: Event): void {
    const el = this.textarea;
    const caret = el.selectionStart;
    if (caret !== el.selectionEnd) return;
    const line = this.lineBefore(caret);
    if (line.text !== BULLET) return;
    event.preventDefault();
    this.update(el.value.slice(0, line.start) + el.value.slice(caret), line.start);
  }

  /** "- " typed at the start of a line becomes "• " (same length: the caret does not move) */
  protected convertShortcut(): void {
    const el = this.textarea;
    const caret = el.selectionStart;
    const line = this.lineBefore(caret);
    if (line.text !== BULLET_SHORTCUT) return;
    this.update(el.value.slice(0, line.start) + BULLET + el.value.slice(caret), caret);
  }

  /** Start of the line of `caret` and its text up to the caret */
  private lineBefore(caret: number): { start: number; text: string } {
    const start = this.textarea.value.lastIndexOf('\n', caret - 1) + 1;
    return { start, text: this.textarea.value.slice(start, caret) };
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
