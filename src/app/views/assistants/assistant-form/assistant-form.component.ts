import { Component, OnInit, EventEmitter, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { OAAssistant } from '../../../../lib/entities/OAAssistant';

@Component({
  selector: 'app-assistant-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    ButtonModule,
    CardModule,
    MultiSelectModule,
    InputNumberModule,
    DialogModule
  ],
  templateUrl: './assistant-form.component.html',
  styleUrls: ['./assistant-form.component.scss']
})
export class AssistantFormComponent implements OnInit, OnChanges {
  @Input() visible = false;
  @Input() assistant: OAAssistant | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  assistantForm: FormGroup;
  loading = false;
  availableModels = ['gpt-4', 'gpt-3.5-turbo'];
  availableFunctions = [
    { name: 'code_interpreter' },
    { name: 'retrieval' }
  ];

  constructor(private fb: FormBuilder) {
    this.assistantForm = this.fb.group({
      name: ['', Validators.required],
      instructions: [''],
      model: ['gpt-4', Validators.required],
      temperature: [1],
      tools: [[]]
    });
  }

  ngOnInit() {
    this.resetForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['assistant'] && this.assistant) {
      console.log('Assistant changed:', this.assistant);
      this.assistantForm.patchValue({
        name: this.assistant.name || '',
        instructions: this.assistant.instructions || '',
        model: this.assistant.model || 'gpt-4',
        tools: Array.isArray(this.assistant.tools) ? this.assistant.tools : [],
        temperature: this.assistant.temperature || 1
      });
    }
  }

  private resetForm() {
    this.assistantForm.reset({
      model: 'gpt-4',
      temperature: 1,
      tools: []
    });
  }

  onSubmit() {
    if (this.assistantForm.valid) {
      this.loading = true;
      const formData = this.assistantForm.value;
      this.save.emit({
        ...formData,
        id: this.assistant?.id
      });
    }
  }

  hideDialog() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
    this.resetForm();
  }
}
