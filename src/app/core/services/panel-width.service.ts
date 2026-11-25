import { Injectable, WritableSignal, signal } from '@angular/core';
import { readPreference, writePreference } from '../utils/local-storage';

/** The side panels whose width can be changed */
export type PanelName = 'sidebar' | 'transcript' | 'tokens';

/**
 * Width (px) of each side panel chosen by dragging its edge (see PanelResize); null = default
 * width (--panel-width). Remembered in the browser, so it is kept from one page to the other.
 */
@Injectable({ providedIn: 'root' })
export class PanelWidthService {
  private readonly widths = new Map<PanelName, WritableSignal<number | null>>();

  width(name: PanelName): number | null {
    return this.signalOf(name)();
  }

  /** `null`: back to the default width */
  set(name: PanelName, width: number | null): void {
    const rounded = width === null ? null : Math.round(width);
    this.signalOf(name).set(rounded);
    writePreference(storageKey(name), rounded === null ? null : String(rounded));
  }

  private signalOf(name: PanelName): WritableSignal<number | null> {
    let width = this.widths.get(name);
    if (!width) {
      width = signal(Number(readPreference(storageKey(name))) || null);
      this.widths.set(name, width);
    }
    return width;
  }
}

/** "transcriptWidth" is the key the transcript already used */
const storageKey = (name: PanelName) => `${name}Width`;
