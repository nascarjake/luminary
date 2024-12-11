import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { FunctionNodesService } from '../../services/function-nodes.service';
import { FunctionNode } from '../../interfaces/function-nodes';
import { FunctionEditorComponent, FunctionDefinition } from '../function-editor/function-editor.component';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-function-library',
  standalone: true,
  imports: [CommonModule, ButtonModule, FunctionEditorComponent, ConfirmDialogModule],
  providers: [],
  template: `
    <div class="function-library">
      <div class="header">
        <h3>Function Library</h3>
        <p-button 
          icon="pi pi-plus" 
          (onClick)="showFunctionEditor()"
          styleClass="p-button-text"
          size="small"
        ></p-button>
      </div>
      <div class="function-list">
        <div 
          *ngFor="let func of functions" 
          class="function-item"
          draggable="true"
          (dragstart)="onDragStart($event, func)"
        >
          <div class="function-content">
            <i class="pi pi-code"></i>
            <span>{{ func.name }}</span>
          </div>
          <div class="function-actions">
            <p-button 
              icon="pi pi-pencil" 
              (onClick)="editFunction(func)"
              styleClass="p-button-text p-button-sm"
              size="small"
            ></p-button>
            <p-button 
              icon="pi pi-trash" 
              (onClick)="confirmDelete(func)"
              styleClass="p-button-text p-button-danger p-button-sm"
              size="small"
            ></p-button>
          </div>
        </div>
      </div>
    </div>
    <app-function-editor
      [(visible)]="functionEditorVisible"
      [standalone]="true"
      [function]="selectedFunction"
      (save)="onFunctionSave($event)"
    ></app-function-editor>
  `,
  styles: [`
    .function-library {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 250px;
      padding-top: 1rem;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0.5rem;
    }

    h3 {
      margin: 0;
      padding: 0;
      font-size: 1.2rem;
      color: var(--text-color);
    }

    .function-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0 0.5rem;
      overflow-y: auto;
    }

    .function-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem;
      background-color: var(--surface-section);
      border-radius: 6px;
      cursor: move;
      user-select: none;
      transition: background-color 0.2s;

      &:hover {
        background-color: var(--surface-hover);
      }
    }

    .function-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      
      i {
        color: var(--primary-color);
      }
    }

    .function-actions {
      display: flex;
      gap: 0.25rem;
      opacity: 0;
      transition: opacity 0.2s;

      .function-item:hover & {
        opacity: 1;
      }
    }
  `]
})
export class FunctionLibraryComponent implements OnInit {
  functions: FunctionNode[] = [];
  functionEditorVisible = false;
  selectedFunction: FunctionNode | null = null;

  constructor(
    private functionNodesService: FunctionNodesService, 
    private configService: ConfigService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.loadFunctions();
  }

  private async loadFunctions() {
    try {
      this.functions = await this.functionNodesService.listFunctions();
    } catch (error) {
      console.error('Failed to load functions:', error);
    }
  }

  showFunctionEditor() {
    this.selectedFunction = null;
    this.functionEditorVisible = true;
  }

  editFunction(func: FunctionNode) {
    this.selectedFunction = func;
    this.functionEditorVisible = true;
  }

  confirmDelete(func: FunctionNode) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the function "${func.name}"?`,
      accept: () => {
        this.deleteFunction(func);
      }
    });
  }

  async deleteFunction(func: FunctionNode) {
    try {
      const profile = this.configService.getActiveProfile();
      if (!profile) {
        console.error('No active profile found');
        return;
      }
      await this.functionNodesService.deleteFunctionNode(profile.id, func.id);
      await this.loadFunctions(); // Reload the list
    } catch (error) {
      console.error('Failed to delete function:', error);
    }
  }

  private convertFunctionDefinitionToNode(def: FunctionDefinition): FunctionNode {
    if (!def.implementation) {
      throw new Error('Function implementation is required');
    }

    return {
      id: '', // Will be generated by service
      name: def.name,
      description: def.description || '', // Ensure description is included
      command: def.implementation.command,
      script: def.implementation.script,
      workingDir: def.implementation.workingDir,
      timeout: def.implementation.timeout,
      environmentVariables: def.implementation.environmentVariables,
      inputs: def.inputs || [],  // Use the inputs directly from FunctionDefinition
      outputs: def.outputs || [], // Use the outputs directly from FunctionDefinition
      metadata: {
        category: 'standalone'
      },
      parameters: def.parameters // Include parameters if available
    };
  }

  async onFunctionSave(def: FunctionDefinition) {
    try {
      const functionNode = this.convertFunctionDefinitionToNode(def);
      await this.functionNodesService.saveFunction(functionNode);
      await this.loadFunctions(); // Reload the list
    } catch (error) {
      console.error('Failed to save function:', error);
    }
  }

  onDragStart(event: DragEvent, func: FunctionNode) {
    if (event.dataTransfer) {
      const nodeData = {
        type: 'function/node',
        id: func.id,
        name: func.name,
        inputs: func.inputs.map(input => ({
          name: input,
          schemaId: input,
          type: input
        })),
        outputs: func.outputs.map(output => ({
          name: output,
          schemaId: output,
          type: output
        }))
      };
      event.dataTransfer.setData('application/json', JSON.stringify(nodeData));
    }
  }
}
