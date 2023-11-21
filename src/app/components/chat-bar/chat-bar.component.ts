import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';

@Component({
  selector: 'app-chat-bar',
  standalone: true,
  imports: [
    CommonModule,
    InputTextareaModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule
  ],
  templateUrl: './chat-bar.component.html',
  styleUrl: './chat-bar.component.scss'
})
export class ChatBarComponent implements OnChanges {

  @Input() public threadId?: string;
  @Input() public assistantId?: string;
  @Output() public onSubmitMessage = new EventEmitter<string>();

  public messageForm = new FormGroup({
    message: new FormControl(
      { value: '', disabled: !this.assistantId },
      [ Validators.required ]
    ),
  });

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['assistantId']) {
      if (changes['assistantId'].currentValue) {
        this.messageForm.get('message')!.enable();
      } else {
        this.messageForm.get('message')!.disable();
      }
    }
  }

  public async onSubmit(): Promise<void> {
    this.onSubmitMessage.emit(this.messageForm.value.message!);
  }
}
