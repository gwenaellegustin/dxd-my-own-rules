import { InjectionToken } from '@angular/core';

/**
 * Base URL of the backend API.
 * The prototype reads static JSON files from `public/mock-api/`;
 * point this to the real backend when it exists.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'mock-api',
});

export const API_ENDPOINTS = {
  currentUser: 'current-user.json',
  clients: 'clients.json',
  vehicleBrands: 'vehicle-brands.json',
  worksheetTemplate: 'worksheet-template.json',
  worksheets: 'worksheets.json',
  transcripts: 'transcripts.json',
  shoppingList: 'shopping-list.json',
} as const;
