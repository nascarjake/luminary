import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { OAThreadMessage } from '../../../lib/entities/OAThreadMessage';

@Component({
  selector: 'app-chat-content',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './chat-content.component.html',
  styleUrl: './chat-content.component.scss'
})
export class ChatContentComponent {

  @Input() public assistantId?: string;
  @Input() public threadId?: string;
  @Input() public threadMessages?: OAThreadMessage[];
}
