import { DOCUMENT } from '@angular/common';
import { Injectable, WritableSignal, computed, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';

/** Data kept in the undo history, read and put back as a whole (immutable values) */
export interface UndoSource<T = unknown> {
  get(): T;
  set(value: T): void;
}

/** State of all the data before an edit, and the page the edit was made on */
interface Step {
  url: string;
  states: Map<UndoSource, unknown>;
}

/** Edits kept in the history */
const HISTORY_LIMIT = 100;
/** Keystrokes in the same field closer than this make one undo step */
const TYPING_GROUP_MS = 1000;

/** Input types that are not typed in */
const NOT_TEXT = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'];

/**
 * Undo / redo of every edit of the app (worksheets, invoices, clients, settings, shopping list):
 * Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z (Cmd on macOS) on every page, and the header buttons.
 *
 * The stores register their data (`track`, once loaded) and call `record()` before each edit. The
 * state of all the data is saved (immutable values: nothing is copied), so one undo puts back
 * everything an edit changed, even across stores (e.g. the observations of an invoice are the
 * comments of its worksheet). One undo step is:
 * - every edit of one user action (same event, e.g. a client and its vehicle created at once);
 * - typing in one field while it goes on, like in a text editor.
 * Undoing an edit made on another page (another worksheet, invoice…) shows that page again.
 *
 * The browser's own undo of the text fields is replaced, so the fields and the data stay in sync.
 * It is kept where the text is not app data: search fields, dialogs (their draft is saved on
 * confirm) and fields inside `data-native-undo` (e.g. a new item not added yet).
 */
@Injectable({ providedIn: 'root' })
export class UndoService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  private readonly sources = new Set<UndoSource>();
  /** States before the edits, most recent last */
  private readonly undoStack = signal<Step[]>([]);
  private readonly redoStack = signal<Step[]>([]);
  /** Text field of the last recorded edit, to group typing */
  private typing: { field: Element; time: number } | null = null;
  /** A step was recorded during the current event: the next edits are part of it */
  private inAction = false;

  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  /** Keyboard shortcuts, on every page */
  init(): void {
    this.document.addEventListener('keydown', (event) => this.onKeydown(event));
  }

  /**
   * Keeps data in the history. Registered once loaded: the loading itself is not an edit (states
   * saved before do not hold that data, it is left as is when they are put back).
   */
  track<T>(source: WritableSignal<T> | UndoSource<T>): void {
    this.sources.add(
      (typeof source === 'function'
        ? { get: () => source(), set: (value: T) => source.set(value) }
        : source) as UndoSource,
    );
  }

  /** Saves the state of the data before an edit: call it first, then edit */
  record(): void {
    if (this.inAction) return;
    this.inAction = true;
    queueMicrotask(() => (this.inAction = false));

    const now = Date.now();
    const field = textField(this.document.activeElement);
    const sameTyping =
      !!field && this.typing?.field === field && now - this.typing.time < TYPING_GROUP_MS;
    this.typing = field ? { field, time: now } : null;
    this.redoStack.set([]);
    if (sameTyping) return;
    const step = this.capture(this.router.url);
    this.undoStack.update((stack) => [...stack, step].slice(-HISTORY_LIMIT));
  }

  /** After an action that cannot be undone (worksheet invoiced, invoice sent…) */
  clear(): void {
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.typing = null;
    // An edit right after (same event) starts a new step
    this.inAction = false;
  }

  /** Puts back the state before the last edit */
  undo(): void {
    const step = this.undoStack().at(-1);
    if (!step) return;
    this.undoStack.update((stack) => stack.slice(0, -1));
    this.redoStack.update((stack) => [...stack, this.capture(step.url)]);
    this.restore(step);
  }

  /** Applies the last undone edit again */
  redo(): void {
    const step = this.redoStack().at(-1);
    if (!step) return;
    this.redoStack.update((stack) => stack.slice(0, -1));
    this.undoStack.update((stack) => [...stack, this.capture(step.url)]);
    this.restore(step);
  }

  private capture(url: string): Step {
    return untracked(() => ({
      url,
      states: new Map([...this.sources].map((source) => [source, source.get()])),
    }));
  }

  private restore({ url, states }: Step): void {
    for (const [source, value] of states) source.set(value);
    this.typing = null;
    if (this.router.url !== url) this.router.navigateByUrl(url);
  }

  private onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return;
    const key = event.key.toLowerCase();
    const undo = key === 'z' && !event.shiftKey;
    const redo = key === 'y' || (key === 'z' && event.shiftKey);
    if ((!undo && !redo) || keepsNativeUndo(event.target)) return;
    event.preventDefault();
    if (undo) this.undo();
    else this.redo();
  }
}

/** The element if it is a text field (typed in), not a checkbox, radio, button… */
function textField(element: Element | null): Element | null {
  if (element instanceof HTMLTextAreaElement) return element;
  if (element instanceof HTMLInputElement && !NOT_TEXT.includes(element.type)) return element;
  return null;
}

/** Text that is not app data: search, dialog drafts, fields marked `data-native-undo` */
function keepsNativeUndo(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement && target.type === 'search') return true;
  return !!target.closest('dialog[open], [data-native-undo]');
}
