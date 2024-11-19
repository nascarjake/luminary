import { Routes } from '@angular/router';
import { LoginComponent } from './views/login/login.component';
import { ChatComponent } from './views/chat/chat.component';
import { ObjectManagerComponent } from './modules/object-manager/components/object-manager/object-manager.component';
import { SchemaListComponent } from './modules/object-manager/components/schema-list/schema-list.component';
import { InstanceListComponent } from './modules/object-manager/components/instance-list/instance-list.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'chat', component: ChatComponent },
  {
    path: 'objects',
    component: ObjectManagerComponent,
    children: [
      { path: '', redirectTo: 'schemas', pathMatch: 'full' },
      { path: 'schemas', component: SchemaListComponent },
      { path: 'instances/:schemaId', component: InstanceListComponent }
    ]
  }
];
