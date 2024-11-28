import { Component, OnInit } from '@angular/core';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-output-preview',
  standalone: true,
  imports: [
    CommonModule,
    AccordionModule,
    ButtonModule
  ],
  template: `
    <div class="output-preview">
      <h2>Output Functions Preview</h2>
      <p>The following output functions will be created:</p>
      
      <div *ngFor="let func of functions" class="function-preview">
        <h3>{{func.function.name}}</h3>
        <p>{{func.function.description}}</p>
        <p-accordion>
          <p-accordionTab header="Function Schema" [selected]="functions.length === 1">
            <pre>{{func | json}}</pre>
          </p-accordionTab>
        </p-accordion>
      </div>

      <div class="actions">
        <p-button label="Cancel" (onClick)="cancel()" styleClass="p-button-text"></p-button>
        <p-button label="Confirm" (onClick)="confirm()" styleClass="p-button-primary"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .output-preview {
      padding: 1rem;
    }
    .function-preview {
      margin-bottom: 1rem;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    pre {
      background: var(--surface-ground);
      padding: 1rem;
      border-radius: 6px;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    :host ::ng-deep .p-accordion .p-accordion-header:not(.p-disabled).p-highlight .p-accordion-header-link {
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
    }
    :host ::ng-deep .p-accordion .p-accordion-content {
      border-top: 0;
      border-top-right-radius: 0;
      border-top-left-radius: 0;
    }
  `]
})
export class OutputPreviewComponent implements OnInit {
  functions: any[] = [];

  constructor(
    private ref: DynamicDialogRef,
    private config: DynamicDialogConfig
  ) {}

  ngOnInit() {
    this.functions = this.config.data?.functions || [];
  }

  confirm() {
    this.ref.close(true);
  }

  cancel() {
    this.ref.close(false);
  }
}
