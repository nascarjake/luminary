import { Component, OnInit, ViewChildren, QueryList, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { defaultKeymap } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import { oneDark } from '@codemirror/theme-one-dark';

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
      <p>The following output functions will be created:</p>
      
      <div *ngFor="let func of functions; let i = index" class="function-preview">
        <h3>{{func.function.name}}</h3>
        <p>{{func.function.description}}</p>
        <p-accordion>
          <p-accordionTab header="Function Schema" [selected]="functions.length === 1">
            <div class="editor-container" #editorContainer></div>
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
    .editor-container {
      height: 300px;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
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
export class OutputPreviewComponent implements OnInit, AfterViewInit, OnDestroy {
  functions: any[] = [];
  editors: EditorView[] = [];

  @ViewChildren('editorContainer') editorContainers!: QueryList<ElementRef>;

  constructor(
    private ref: DynamicDialogRef,
    private config: DynamicDialogConfig
  ) {}

  ngOnInit() {
    this.functions = this.config.data?.functions || [];
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initializeEditors();
    });
  }

  ngOnDestroy() {
    this.editors.forEach(editor => editor.destroy());
  }

  private initializeEditors() {
    this.editorContainers.forEach((container, index) => {
      const startState = EditorState.create({
        doc: JSON.stringify(this.functions[index].function, null, 2),
        extensions: [
          basicSetup,
          json(),
          keymap.of(defaultKeymap),
          oneDark,
          EditorView.theme({
            "&": { height: "100%" },
            ".cm-scroller": { overflow: "auto" }
          }),
          EditorState.readOnly.of(true)
        ]
      });

      const editor = new EditorView({
        state: startState,
        parent: container.nativeElement
      });

      this.editors.push(editor);
    });
  }

  confirm() {
    this.ref.close(true);
  }

  cancel() {
    this.ref.close(false);
  }
}
