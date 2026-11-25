import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DesignToken, DesignTokensService, TOKEN_GROUPS } from '../../../core/services/design-tokens.service';
import { PanelWidthService } from '../../../core/services/panel-width.service';
import { Icon } from '../../../shared/icon/icon';
import { Clearable } from '../../../shared/clearable/clearable';
import { PanelResize } from '../../../shared/panel-resize/panel-resize';

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Token editor of the design system page: a side panel like the others (right, collapses to a
 * rail, width changed by dragging its left edge). A changed value applies to the whole app at
 * once; the changes can be copied to be pasted into _tokens.scss.
 */
@Component({
  selector: 'app-token-panel',
  imports: [TranslatePipe, Icon, Clearable, PanelResize],
  templateUrl: './token-panel.html',
  styleUrl: './token-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'open()' },
})
export class TokenPanel {
  readonly open = input(false);
  readonly openChange = output<boolean>();

  protected readonly ds = inject(DesignTokensService);
  protected readonly widths = inject(PanelWidthService);

  /** Tokens whose name contains the filter, by group */
  protected readonly filter = signal('');
  protected readonly groups = computed(() => {
    const query = this.filter().trim().toLowerCase();
    return TOKEN_GROUPS.map((id) => ({
      id,
      tokens: this.ds.tokens.filter((t) => t.group === id && t.name.includes(query)),
    })).filter((group) => group.tokens.length > 0);
  });

  protected readonly copied = signal(false);

  protected isColor(token: DesignToken): boolean {
    return HEX_COLOR.test(this.ds.value(token));
  }

  /** <input type="color"> only takes #rrggbb */
  protected colorPickerValue(token: DesignToken): string {
    const hex = this.ds.value(token).slice(1);
    const rgb = hex.length <= 4 ? [...hex.slice(0, 3)].map((c) => c + c).join('') : hex.slice(0, 6);
    return '#' + rgb.toLowerCase();
  }

  protected copyChanges(): void {
    navigator.clipboard?.writeText(this.ds.changesAsCss()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  /** Translation key of "when is this token used" (designSystem.usage, by name without "--") */
  protected usageKey(name: string): string {
    return 'designSystem.usage.' + name.slice(2);
  }
}
