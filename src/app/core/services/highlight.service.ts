import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranscriptTarget } from '../models/transcript.model';
import { scrollIntoArea } from '../../shared/scroll-into-area';

const HIGHLIGHT_CLASS = 'is-highlighted';
/** How long to wait for the target page to show the element */
const FIND_TIMEOUT_MS = 3000;
/** Frames the element must stay the same before it is highlighted */
const STABLE_FRAMES = 5;

/**
 * Opens a worksheet or an invoice and highlights one of its elements (border), e.g. the field a
 * transcript change refers to. Elements are found by their `data-area` attribute. The highlight
 * stays until the next click anywhere.
 */
@Injectable({ providedIn: 'root' })
export class HighlightService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  async show(target: TranscriptTarget, area: string): Promise<void> {
    const route =
      target.type === 'shopping-list'
        ? ['/shopping-list']
        : [target.type === 'worksheet' ? '/worksheets' : '/invoices', target.id];
    await this.router.navigate(route);
    const element = await this.find(area);
    if (!element) return;

    this.clear();
    element.classList.add(HIGHLIGHT_CLASS);
    scrollIntoArea(element, { block: 'center', smooth: true });
    // Removed by the next click (registered after this one has finished)
    setTimeout(() => this.document.addEventListener('pointerdown', () => this.clear(), { once: true }));
  }

  private clear(): void {
    this.document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
  }

  /**
   * The page may still be loading or re-rendering (another worksheet selected): look on each
   * frame until the same element is found several frames in a row, or too late
   */
  private find(area: string): Promise<HTMLElement | null> {
    const start = performance.now();
    let previous: HTMLElement | null = null;
    let stableFrames = 0;
    return new Promise((resolve) => {
      const look = () => {
        const element = this.document.querySelector<HTMLElement>(`[data-area="${CSS.escape(area)}"]`);
        stableFrames = element && element === previous ? stableFrames + 1 : 0;
        previous = element;
        if (stableFrames >= STABLE_FRAMES || performance.now() - start > FIND_TIMEOUT_MS) resolve(element);
        else requestAnimationFrame(look);
      };
      look();
    });
  }
}
