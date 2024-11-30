import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimeNGModule } from './shared/primeng.module';
import { ObjectManagerModule } from './modules/object-manager/object-manager.module';
import { ObjectSchemaService } from './services/object-schema.service';
import { ObjectInstanceService } from './services/object-instance.service';
import { ObjectMigrationService } from './services/object-migration.service';
import { GeneratedObjectsService } from './services/generated-objects.service';
import { TitleBarComponent } from './components/title-bar/title-bar.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    MessageService,
    ObjectSchemaService,
    ObjectInstanceService,
    ObjectMigrationService,
    GeneratedObjectsService,
    TitleBarComponent,
    importProvidersFrom([
      BrowserAnimationsModule,
      FormsModule,
      ReactiveFormsModule,
      PrimeNGModule,
      ObjectManagerModule
    ])
  ]
};
