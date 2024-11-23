import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { GraphEditorComponent } from '../views/graph-editor/graph-editor.component';

@Injectable({
  providedIn: 'root'
})
export class LeaveGraphGuard implements CanDeactivate<GraphEditorComponent> {
  canDeactivate(component: GraphEditorComponent): boolean {
    if (component.hasUnsavedChanges()) {
      return window.confirm('You have unsaved changes. Are you sure you want to leave?');
    }
    return true;
  }
}
