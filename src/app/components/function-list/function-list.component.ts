import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { FunctionEditorComponent, FunctionDefinition } from '../function-editor/function-editor.component';

@Component({
  selector: 'app-function-list',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    TooltipModule,
    FunctionEditorComponent
  ],
  template: `
    <div class="function-list">
      <div class="function-list-header">
        <h3>Functions</h3>
        <p-button
          icon="pi pi-plus"
          (onClick)="showAddFunction()"
          [rounded]="true"
          [text]="true"
          pTooltip="Add Function"
        ></p-button>
      </div>

      <div class="functions">
        <div *ngIf="functions.length === 0" class="no-functions">
          <p>No functions added yet. Click the + button to add a function.</p>
        </div>

        <div *ngFor="let func of functions; let i = index" class="function-item">
          <p-card>
            <div class="function-header">
              <h4>{{ func.name }}</h4>
              <div class="function-actions">
                <p-button
                  icon="pi pi-pencil"
                  (onClick)="showEditFunction(i)"
                  [rounded]="true"
                  [text]="true"
                  pTooltip="Edit Function"
                ></p-button>
                <p-button
                  icon="pi pi-trash"
                  (onClick)="deleteFunction(i)"
                  [rounded]="true"
                  [text]="true"
                  severity="danger"
                  pTooltip="Delete Function"
                ></p-button>
              </div>
            </div>
            <p class="description">{{ func.description }}</p>
          </p-card>
        </div>
      </div>
    </div>

    <app-function-editor
      [(visible)]="showEditor"
      [function]="selectedFunction"
      (save)="onFunctionSave($event)"
      (cancel)="hideEditor()"
    ></app-function-editor>
  `,
  styles: [`
    .function-list {
      .function-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;

        h3 {
          margin: 0;
        }
      }

      .no-functions {
        text-align: center;
        color: var(--text-color-secondary);
        padding: 2rem;
        background: var(--surface-ground);
        border-radius: 6px;
      }

      .functions {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .function-item {
        :host ::ng-deep .p-card {
          .p-card-body {
            padding: 1rem;
          }
        }

        .function-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;

          h4 {
            margin: 0;
            color: var(--primary-color);
          }

          .function-actions {
            display: flex;
            gap: 0.5rem;
          }
        }

        .description {
          margin: 0;
          color: var(--text-color-secondary);
          font-size: 0.875rem;
        }
      }
    }
  `]
})
export class FunctionListComponent {
  @Input() functions: FunctionDefinition[] = [];
  @Output() functionsChange = new EventEmitter<FunctionDefinition[]>();

  showEditor = false;
  selectedFunction: FunctionDefinition | null = null;
  selectedIndex: number | null = null;

  showAddFunction() {
    this.selectedFunction = null;
    this.selectedIndex = null;
    this.showEditor = true;
  }

  showEditFunction(index: number) {
    this.selectedFunction = { ...this.functions[index] };
    this.selectedIndex = index;
    this.showEditor = true;
  }

  hideEditor() {
    this.showEditor = false;
    this.selectedFunction = null;
    this.selectedIndex = null;
  }

  onFunctionSave(func: FunctionDefinition) {
    const newFunctions = [...this.functions];
    
    if (this.selectedIndex !== null) {
      newFunctions[this.selectedIndex] = func;
    } else {
      newFunctions.push(func);
    }

    this.functions = newFunctions;
    this.functionsChange.emit(newFunctions);
    this.hideEditor();
  }

  deleteFunction(index: number) {
    const newFunctions = this.functions.filter((_, i) => i !== index);
    this.functions = newFunctions;
    this.functionsChange.emit(newFunctions);
  }
}
