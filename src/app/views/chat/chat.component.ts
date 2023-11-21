import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatSidebarComponent } from '../../components/chat-sidebar/chat-sidebar.component';
import { ChatContentComponent } from '../../components/chat-content/chat-content.component';
import { ChatBarComponent } from '../../components/chat-bar/chat-bar.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    ChatSidebarComponent,
    ChatContentComponent,
    ChatBarComponent
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {

}
