import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Company } from '../../../core/models/company.model';

/** Footer of the invoice, like the paper one: slogan between a car and a motorbike, contact details */
@Component({
  selector: 'app-invoice-footer',
  imports: [TranslatePipe],
  templateUrl: './invoice-footer.html',
  styleUrl: './invoice-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceFooter {
  readonly company = input.required<Company>();
}
