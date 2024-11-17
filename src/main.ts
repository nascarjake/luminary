/// <reference path="electron.d.ts" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

console.log('Starting application...');
console.log('Running in Electron?', !!window.electron);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
