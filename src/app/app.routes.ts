import { Routes } from '@angular/router';
import { ObjectManagerComponent } from './modules/object-manager/components/object-manager/object-manager.component';
import { SchemaListComponent } from './modules/object-manager/components/schema-list/schema-list.component';
import { InstanceListComponent } from './modules/object-manager/components/instance-list/instance-list.component';
import { LeaveGraphGuard } from './guards/leave-graph.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/login/login.component').then(c => c.LoginComponent)
  },
  {
    path: 'chat',
    loadComponent: () => import('./views/chat/chat.component').then(c => c.ChatComponent)
  },
  {
    path: 'assistants',
    loadComponent: () => import('./views/assistants/assistants.component').then(c => c.AssistantsComponent)
  },
  {
    path: 'graph',
    loadComponent: () => import('./views/graph-editor/graph-editor.component').then(c => c.GraphEditorComponent),
    canDeactivate: [LeaveGraphGuard]
  },
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
