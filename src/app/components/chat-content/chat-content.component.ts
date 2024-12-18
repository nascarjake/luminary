import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
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
export class ChatContentComponent implements OnChanges, AfterViewChecked, OnDestroy {

  @Input() public loading?: boolean;
  @Input() public assistantId?: string;
  @Input() public threadId?: string;
  @Input() public threadMessages?: OAThreadMessage[];

  private shouldScroll = false;
  private isFollowingMessages = true;
  private lastScrollTop = 0;
  private lastScrollHeight = 0;
  private scrollThreshold = 100; // pixels from bottom to consider "at bottom"
  private userHasScrolled = false;
  private lastUserInteraction = 0;
  private readonly scrollCooldown = 1000; // ms to wait after user scroll before auto-scrolling

  constructor(private elementRef: ElementRef) {
    // Listen for scroll events
    this.elementRef.nativeElement.addEventListener('scroll', this.handleScroll.bind(this));
    // Listen for user interaction
    this.elementRef.nativeElement.addEventListener('wheel', this.handleUserInteraction.bind(this));
    this.elementRef.nativeElement.addEventListener('touchmove', this.handleUserInteraction.bind(this));
  }

  private handleUserInteraction(event: Event): void {
    this.userHasScrolled = true;
    this.lastUserInteraction = Date.now();
    
    const element = this.elementRef.nativeElement;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < this.scrollThreshold;
    
    // If user scrolls up, disable follow mode
    if (!atBottom) {
      this.isFollowingMessages = false;
    }
  }

  private handleScroll(): void {
    const element = this.elementRef.nativeElement;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < this.scrollThreshold;
    
    // Only update follow mode if this was a user-initiated scroll
    if (this.userHasScrolled) {
      this.isFollowingMessages = atBottom;
      // Reset the flag after handling
      this.userHasScrolled = false;
    }
    
    this.lastScrollTop = element.scrollTop;
    this.lastScrollHeight = element.scrollHeight;
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['threadMessages']?.currentValue !== changes['threadMessages']?.previousValue) {
      const element = this.elementRef.nativeElement;
      const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < this.scrollThreshold;
      const timeSinceUserScroll = Date.now() - this.lastUserInteraction;
      
      // Only auto-scroll if:
      // 1. We're following messages AND
      // 2. Either:
      //    a. We're at the bottom OR
      //    b. No recent user interaction
      this.shouldScroll = this.isFollowingMessages && 
        (atBottom || timeSinceUserScroll > this.scrollCooldown);
    }
  }

  async ngAfterViewChecked(): Promise<void> {
    if (this.shouldScroll) {
      await this.smoothScrollToBottom();
      this.shouldScroll = false;
    }
  }

  private async smoothScrollToBottom(): Promise<void> {
    try {
      await tick(10);
      const element = this.elementRef.nativeElement;
      
      // Don't scroll if user has recently interacted
      if (Date.now() - this.lastUserInteraction < this.scrollCooldown) {
        return;
      }
      
      // If the height hasn't changed much, don't scroll
      if (Math.abs(element.scrollHeight - this.lastScrollHeight) < 10) {
        return;
      }
      
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      });
      
      this.lastScrollHeight = element.scrollHeight;
    } catch (error) {
      console.error('Error scrolling to bottom:', error);
    }
  }

  ngOnDestroy(): void {
    // Clean up event listeners
    this.elementRef.nativeElement.removeEventListener('scroll', this.handleScroll.bind(this));
    this.elementRef.nativeElement.removeEventListener('wheel', this.handleUserInteraction.bind(this));
    this.elementRef.nativeElement.removeEventListener('touchmove', this.handleUserInteraction.bind(this));
  }
}
