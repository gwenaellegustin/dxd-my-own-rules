export interface HourlyRate {
  id: string;
  /** Translation key of the rate name ("Loyalty", "Standard"…) */
  nameKey: string;
  /** CHF per hour */
  price: number;
}

/** The garage: invoice settings and contact details printed on invoices */
export interface Company {
  name: string;
  /** Slogan printed in the invoice footer */
  tagline: string;
  currency: string;
  /** VAT in % */
  vatRate: number;
  vatNumber: string;
  /** Payment term, in days from the date the invoice is sent */
  paymentTermDays: number;
  hourlyRates: HourlyRate[];
  /** Rate of a new invoice */
  defaultRateId: string;
  contact: {
    person: string;
    phone: string;
    email: string;
    website: string;
    workshop: string;
    office: string;
  };
}
