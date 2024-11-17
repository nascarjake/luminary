import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { tick } from '../../../lib/classes/Helper';
import { OAThreadMessage } from '../../../lib/entities/OAThreadMessage';
import { MarkPipe } from '../../pipes/mark.pipe';

@Component({
  selector: 'app-chat-content',
  standalone: true,
  imports: [
    CommonModule,
    AvatarModule,
    ProgressSpinnerModule,
    MarkPipe
  ],
  templateUrl: './chat-content.component.html',
  styleUrl: './chat-content.component.scss'
})
export class ChatContentComponent implements OnChanges, AfterViewChecked {

  @Input() public loading?: boolean;
  @Input() public assistantId?: string;
  @Input() public threadId?: string;
  @Input() public threadMessages?: OAThreadMessage[];

  private shouldScroll = false;

  constructor(private elementRef: ElementRef) {}

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['threadMessages']?.currentValue !== changes['threadMessages']?.previousValue) {
      this.shouldScroll = true;
    }
  }

  async ngAfterViewChecked(): Promise<void> {
    if (this.shouldScroll) {
      await this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private async scrollToBottom(): Promise<void> {
    try {
      await tick(50); // Small delay to ensure content is rendered
      const element = this.elementRef.nativeElement;
      element.scrollTop = element.scrollHeight;
    } catch (error) {
      console.error('Error scrolling to bottom:', error);
    }
  }
}
