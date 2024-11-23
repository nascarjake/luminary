import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { OAThreadMessage } from '../../../lib/entities/OAThreadMessage';

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

  private messageHistory: string[] = [];
  private historyIndex: number = -1;
  private tempMessage: string = ''; // Stores current message when navigating history

  @Input() public threadId?: string;
  @Input() public assistantId?: string;
  @Input() public loading: boolean = false;
  @Input() public threadMessages?: OAThreadMessage[];
  @Output() public onSubmitMessage = new EventEmitter<string>();
  @Output() public onCancelRun = new EventEmitter<void>();

  public messageForm = new FormGroup({
    message: new FormControl(
      { value: '', disabled: !this.assistantId || this.loading },
      [ Validators.required ]
    ),
  });

  @HostListener('document:keydown', ['$event'])
  public async onKeydown(event: KeyboardEvent): Promise<void> {
    const textarea = event.target as HTMLTextAreaElement;
    if (!(textarea instanceof HTMLTextAreaElement) || textarea.id !== 'message') {
      return;
    }

    const messageControl = this.messageForm.get('message')!;
    const cursorPosition = textarea.selectionStart;
    const lines = textarea.value.split('\n');
    let currentLineIndex = 0;
    let currentLineStart = 0;

    // Find which line the cursor is on
    for (const line of lines) {
      if (currentLineStart + line.length >= cursorPosition) {
        break;
      }
      currentLineStart += line.length + 1; // +1 for newline
      currentLineIndex++;
    }

    if (event.key === 'ArrowUp' && currentLineIndex === 0 && cursorPosition <= currentLineStart) {
      event.preventDefault();
      if (this.historyIndex === -1) {
        // Save current message before navigating history
        this.tempMessage = messageControl.value || '';
      }
      if (this.historyIndex < this.messageHistory.length - 1) {
        this.historyIndex++;
        messageControl.setValue(this.messageHistory[this.messageHistory.length - 1 - this.historyIndex]);
        // Move cursor to end of text
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
        });
      }
    } else if (event.key === 'ArrowDown' && currentLineIndex === lines.length - 1 && 
               cursorPosition >= currentLineStart + lines[currentLineIndex].length) {
      event.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        messageControl.setValue(this.messageHistory[this.messageHistory.length - 1 - this.historyIndex]);
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        messageControl.setValue(this.tempMessage);
        this.tempMessage = '';
      }
      // Move cursor to end of text
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      });
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (this.messageForm.valid && !this.loading) await this.onSubmit();
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['assistantId']) {
      if (changes['assistantId'].currentValue) {
        this.messageForm.get('message')!.enable();
      } else {
        this.messageForm.get('message')!.disable();
      }
    }
    
    if (changes['loading']) {
      if (changes['loading'].currentValue) {
        this.messageForm.get('message')!.disable();
      } else if (this.assistantId) {
        this.messageForm.get('message')!.enable();
      }
    }

    if (changes['threadMessages'] && this.threadMessages) {
      // Update message history from thread messages, most recent first
      this.messageHistory = this.threadMessages
        .filter(msg => msg.role === 'user' && msg.content[0]?.type === 'text')
        .map(msg => msg.content[0].text!.value); // No need for reverse since threadMessages are already in chronological order
      this.historyIndex = -1;
      this.tempMessage = '';
    }
  }

  public async onSubmit(): Promise<void> {
    if (this.loading) {
      this.onCancelRun.emit();
      return;
    }
    
    const message = this.messageForm.get('message')!.value;
    if (message) {
      // Add message to history
      this.messageHistory.push(message);
      this.historyIndex = -1;
      this.tempMessage = '';
      
      this.onSubmitMessage.emit(message);
      this.messageForm.reset();
    }
  }
}
