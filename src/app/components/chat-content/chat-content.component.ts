import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, ViewContainerRef } from '@angular/core';
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
export class ChatContentComponent implements OnChanges {

  @Input() public loading?: boolean;
  @Input() public assistantId?: string;
  @Input() public threadId?: string;
  @Input() public threadMessages?: OAThreadMessage[];

  constructor(
    private readonly viewRef: ViewContainerRef,
  ) { }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['threadMessages']?.currentValue !== changes['threadMessages']?.previousValue) {
      await tick(150);
      this.viewRef.element.nativeElement.scrollTop = this.viewRef.element.nativeElement.scrollHeight;
    }
  }
}
