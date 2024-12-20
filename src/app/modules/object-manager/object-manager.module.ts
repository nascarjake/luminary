import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// Shared Modules
import { PrimeNGModule } from '../../shared/primeng.module';

// Components
import { SchemaListComponent } from './components/schema-list/schema-list.component';
import { SchemaEditorComponent } from './components/schema-editor/schema-editor.component';
import { InstanceListComponent } from './components/instance-list/instance-list.component';
import { InstanceEditorComponent } from './components/instance-editor/instance-editor.component';
import { ObjectManagerComponent } from './components/object-manager/object-manager.component';

const routes: Routes = [
  {
    path: '',
    component: ObjectManagerComponent,
    children: [
      { path: '', redirectTo: 'schemas', pathMatch: 'full' },
      { path: 'schemas', component: SchemaListComponent },
      { path: 'instances/:schemaId', component: InstanceListComponent }
    ]
  }
];

@NgModule({
  declarations: [
    SchemaListComponent,
    SchemaEditorComponent,
    InstanceListComponent,
    InstanceEditorComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    PrimeNGModule,
    ObjectManagerComponent
  ],
  exports: [ObjectManagerComponent]
})
export class ObjectManagerModule { }
