import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimeNGModule } from './shared/primeng.module';
import { ObjectManagerModule } from './modules/object-manager/object-manager.module';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    importProvidersFrom([
      FormsModule,
      ReactiveFormsModule,
      PrimeNGModule,
      ObjectManagerModule
    ])
  ]
};
