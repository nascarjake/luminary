import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { PrimeNGModule } from './shared/primeng.module';
import { ObjectManagerModule } from './modules/object-manager/object-manager.module';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    importProvidersFrom([
      HttpClientModule,
      FormsModule,
      ReactiveFormsModule,
      PrimeNGModule,
      ObjectManagerModule
    ])
  ],
};
