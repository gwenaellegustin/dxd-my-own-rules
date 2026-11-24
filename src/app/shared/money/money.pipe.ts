import { Pipe, PipeTransform } from '@angular/core';

/** Swiss amounts with 2 decimals and a thousands separator: 1’340.00 */
const MONEY_FORMAT = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: number | null | undefined): string {
    return amount == null ? '' : MONEY_FORMAT.format(amount);
  }
}
