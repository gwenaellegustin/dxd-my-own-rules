import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'worksheets' },
  {
    path: 'worksheets',
    loadComponent: () => import('./features/worksheet/worksheet-page/worksheet-page').then((m) => m.WorksheetPage),
  },
  {
    path: 'worksheets/:id',
    loadComponent: () => import('./features/worksheet/worksheet-page/worksheet-page').then((m) => m.WorksheetPage),
  },
  {
    path: 'invoices',
    loadComponent: () => import('./features/invoice/invoice-page/invoice-page').then((m) => m.InvoicePage),
  },
  {
    path: 'invoices/:id',
    loadComponent: () => import('./features/invoice/invoice-page/invoice-page').then((m) => m.InvoicePage),
  },
  {
    path: 'clients',
    loadComponent: () => import('./features/clients/clients-page/clients-page').then((m) => m.ClientsPage),
  },
  {
    path: 'clients/:id',
    loadComponent: () => import('./features/clients/clients-page/clients-page').then((m) => m.ClientsPage),
  },
  {
    path: 'shopping-list',
    loadComponent: () => import('./features/shopping-list/shopping-list-page').then((m) => m.ShoppingListPage),
  },
  { path: '**', redirectTo: 'worksheets' },
];
