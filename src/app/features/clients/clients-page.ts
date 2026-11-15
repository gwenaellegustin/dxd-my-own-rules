import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page/placeholder-page';

// TODO: to be designed
@Component({
  selector: 'app-clients-page',
  imports: [PlaceholderPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-placeholder-page titleKey="nav.clients" />`,
})
export class ClientsPage {}
