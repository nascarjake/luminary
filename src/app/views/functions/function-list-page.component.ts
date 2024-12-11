import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNGModule } from '../../shared/primeng.module';
import { RouterModule } from '@angular/router';
import { FunctionNodesService } from '../../services/function-nodes.service';
import { FunctionNode } from '../../interfaces/function-nodes';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfigService } from '../../services/config.service';
import { FunctionEditorComponent } from '../../components/function-editor/function-editor.component';
import { FunctionDefinition } from '../../components/function-editor/function-editor.component';

@Component({
  selector: 'app-function-list-page',
  standalone: true,
  imports: [
    CommonModule,
    PrimeNGModule,
    RouterModule,
    FunctionEditorComponent
  ],
  templateUrl: './function-list-page.component.html',
  styleUrls: ['./function-list-page.component.scss']
})
export class FunctionListPageComponent implements OnInit {
  functions: FunctionNode[] = [];
  loading = false;
  showDialog = false;
  selectedFunction: FunctionNode | null = null;

  constructor(
    private functionNodesService: FunctionNodesService,
    private configService: ConfigService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    // Subscribe to project changes
    this.configService.activeProject$.subscribe(project => {
      if (project) {
        console.log('Active project changed, reloading functions...');
        this.loadFunctions();
      }
    });
  }

  ngOnInit() {
    this.loadFunctions();
  }

  private async loadFunctions() {
    this.loading = true;
    try {
      const profile = this.configService.getActiveProfile();
      if (!profile) {
        throw new Error('No active profile found');
      }
      this.functions = await this.functionNodesService.getAllFunctionNodes(profile.id);
    } catch (error) {
      console.error('Error loading functions:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load functions'
      });
    } finally {
      this.loading = false;
    }
  }

  editFunction(func: FunctionNode) {
    this.selectedFunction = { ...func }; // Clone the function for editing
    this.showDialog = true; // Show the dialog for editing
  }

  createFunction() {
    this.selectedFunction = null; // Clear selection for new function
    this.showDialog = true; // Show the dialog for creating a new function
  }

  async deleteFunction(func: FunctionNode) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the function "${func.name}"?`,
      header: 'Delete Confirmation',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          const profile = this.configService.getActiveProfile();
          if (!profile) {
            throw new Error('No active profile found');
          }
          await this.functionNodesService.deleteFunctionNode(profile.id, func.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Function deleted successfully'
          });
          this.loadFunctions();
        } catch (error) {
          console.error('Error deleting function:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete function'
          });
        }
      }
    });
  }

  onDialogHide() {
    this.selectedFunction = null; // Reset selected function when dialog is closed
    this.loadFunctions(); // Reload functions after dialog close
  }

  onFunctionSave(functionDefinition: FunctionDefinition) {
    const functionNode: FunctionNode = {
      id: functionDefinition.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(), // Generate a unique ID
      name: functionDefinition.name,
      description: functionDefinition.description,
      command: functionDefinition.implementation?.command || '',
      script: functionDefinition.implementation?.script || '',
      workingDir: functionDefinition.implementation?.workingDir,
      timeout: functionDefinition.implementation?.timeout,
      environmentVariables: functionDefinition.implementation?.environmentVariables,
      inputs: functionDefinition.inputs || [],
      outputs: functionDefinition.outputs || [],
      parameters: functionDefinition.parameters,
    };

    if (this.selectedFunction) {
      // Update existing function
      const index = this.functions.findIndex(fn => fn.id === this.selectedFunction.id);
      if (index !== -1) {
        this.functions[index] = functionNode;
      }
    } else {
      // Create new function
      this.functions.push(functionNode);
    }

    this.showDialog = false;
    this.selectedFunction = null;
    this.loadFunctions(); // Reload functions after save
  }
}
