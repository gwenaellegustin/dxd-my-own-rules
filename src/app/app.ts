import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeader } from './layout/app-header/app-header';
import { GridBackdrop } from './layout/grid-backdrop/grid-backdrop';
import { DesignTokensService } from './core/services/design-tokens.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeader, GridBackdrop],
  template: `
    <!-- The grid of the background and the effects of the elements lying on it -->
    <app-grid-backdrop />
    <app-header />
    <main class="app-main">
      <router-outlet />
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {
  /** Token values changed in the design system page apply to the whole app, from the start */
  private readonly designTokens = inject(DesignTokensService);
}
