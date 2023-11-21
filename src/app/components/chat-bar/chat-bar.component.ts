import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { OAThread } from '../../../lib/entities/OAThread';

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
export class ChatBarComponent {

  @Input() public thread?: OAThread;
  public messageForm = new FormGroup({
    message: new FormControl(
      { value: '', disabled: !this.thread },
      [ Validators.required ]
    ),
  });

  constructor() { }

  public onSubmit(): void {
    console.log(this.messageForm.value);
  }
}
