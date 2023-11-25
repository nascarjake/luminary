import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
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
  @Input() public loading: boolean = false;
  @Output() public onSubmitMessage = new EventEmitter<string>();

  public messageForm = new FormGroup({
    message: new FormControl(
      { value: '', disabled: !this.assistantId || this.loading },
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

  @HostListener('document:keydown.control.enter', ['$event'])
  @HostListener('document:keydown.meta.enter', ['$event'])
  public async onKeydownHandler(event: KeyboardEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (this.messageForm.valid) await this.onSubmit();
  }

  public async onSubmit(): Promise<void> {
    this.onSubmitMessage.emit(this.messageForm.value.message!);
    this.messageForm.reset();
  }
}
