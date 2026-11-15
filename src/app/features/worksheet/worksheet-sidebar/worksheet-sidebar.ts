import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../../shared/icon/icon';
import { Worksheet, WorksheetStatus } from '../../../core/models/worksheet.model';

interface WorksheetGroup {
  status: WorksheetStatus;
  /** Open worksheets have no heading in the design */
  titleKey: string | null;
  worksheets: Worksheet[];
}

/** "Left sidebar" component set (Default / selected card / Closed). */
@Component({
  selector: 'app-worksheet-sidebar',
  imports: [DatePipe, TranslatePipe, Icon],
  templateUrl: './worksheet-sidebar.html',
  styleUrl: './worksheet-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'open()' },
})
export class WorksheetSidebar {
  readonly worksheets = input.required<Worksheet[]>();
  readonly selectedId = input<string | null>(null);
  readonly open = input(true);

  readonly selectWorksheet = output<string>();
  readonly createWorksheet = output<void>();
  readonly openChange = output<boolean>();

  protected readonly query = signal('');

  protected readonly groups = computed<WorksheetGroup[]>(() => {
    const query = this.query().trim().toLowerCase();
    const matches = this.worksheets().filter(
      (worksheet) => !query || `${worksheet.vehicle} ${worksheet.client}`.toLowerCase().includes(query),
    );
    const group = (status: WorksheetStatus, titleKey: string | null): WorksheetGroup => ({
      status,
      titleKey,
      worksheets: matches.filter((worksheet) => worksheet.status === status),
    });
    return [
      group('open', null),
      group('toBeBilled', 'worksheets.groups.toBeBilled'),
      group('invoiced', 'worksheets.groups.invoiced'),
    ].filter((g) => g.worksheets.length > 0);
  });
}
