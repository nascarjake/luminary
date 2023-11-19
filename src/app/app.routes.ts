import { Routes } from '@angular/router';
import { LoginComponent } from './views/login/login.component';
import { ChatComponent } from './views/chat/chat.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'chat', component: ChatComponent },
];
