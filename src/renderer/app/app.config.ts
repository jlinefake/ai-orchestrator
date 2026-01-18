/**
 * Angular Application Configuration
 * Configures zoneless change detection and providers
 */

import {
  ApplicationConfig,
  provideExperimentalZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Enable zoneless change detection for better performance
    provideExperimentalZonelessChangeDetection(),

    // Router configuration
    provideRouter(routes),
  ],
};
