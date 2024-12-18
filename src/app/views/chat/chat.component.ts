import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Subscription, interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OAThread } from '../../../lib/entities/OAThread';
import { OAThreadMessage } from '../../../lib/entities/OAThreadMessage';
import { OAThreadRun } from '../../../lib/entities/OAThreadRun';
import { AvailableFunctions, OARequiredAction } from '../../../lib/entities/OAFunctionCall';
import { Sequence } from '../../classes/sequence';
import { ChatBarComponent } from '../../components/chat-bar/chat-bar.component';
import { ChatContentComponent } from '../../components/chat-content/chat-content.component';
import { ChatSidebarComponent } from '../../components/chat-sidebar/chat-sidebar.component';
import { ConfigService } from '../../services/config.service';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { AiFunctionService } from '../../services/ai-function.service';
import { AiMessageService } from '../../services/ai-message.service';
import { tick } from '../../../lib/classes/Helper';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SystemMessageOverlayService } from '../../services/system-message-overlay.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    ChatSidebarComponent,
    ChatContentComponent,
    ChatBarComponent,
    ToastModule
  ],
  providers: [
    MessageService
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnInit, OnDestroy {

  @ViewChild(ChatSidebarComponent)
  public chatSidebarComponent!: ChatSidebarComponent;
  public loadingThread: boolean = false;
  public loadingMessage: boolean = false;
  public assistantId?: string;
  public threadId?: string;
  public threadMessages?: OAThreadMessage[];
  private submitSequence: Sequence = new Sequence();
  private message?: string;
  private run?: OAThreadRun;
  private thread?: OAThread;
  private runSubscription?: Subscription;
  private destroy$ = new Subject<void>();

  // Map to store streaming messages by ID
  private streamingMessages = new Map<string, string>();
  // Map to store completed streaming messages until thread updates
  private completedStreamingMessages = new Map<string, string>();

  constructor(
    private readonly openAiApiService: OpenAiApiService,
    private readonly configService: ConfigService,
    private readonly aiFunctionService: AiFunctionService,
    private readonly messageService: MessageService,
    private readonly aiMessageService: AiMessageService,
    private readonly systemMessageOverlayService: SystemMessageOverlayService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {
    // Subscribe to system messages from AiMessageService
    this.aiMessageService.systemMessage$.pipe(takeUntil(this.destroy$)).subscribe(async message => {
      await this.addSystemMessage(message);
    });
  }

  ngOnInit(): void {
    // Subscribe to streaming messages
    this.aiMessageService.streamingMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ threadId, messageId, content, done }) => {
        if (threadId === this.threadId) {
          if (done) {
            // Move to completed messages instead of deleting
            const streamingContent = this.streamingMessages.get(messageId);
            if (streamingContent) {
              this.completedStreamingMessages.set(messageId, streamingContent);
            }
            this.streamingMessages.delete(messageId);
          } else {
            // Update streaming content
            this.streamingMessages.set(messageId, content);
          }
          this.changeDetectorRef.detectChanges();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.runSubscription?.unsubscribe();
  }

  private async addUserMessage(content: string) {
    if (!this.threadMessages) this.threadMessages = [];
    const userMessage: OAThreadMessage = {
      id: `temp-${Date.now()}`,
      created_at: Date.now(),
      thread_id: this.threadId || '',
      role: 'user' as const,
      object: 'thread.message',
      content: [{
        type: 'text',
        text: {
          value: content,
          annotations: []
        }
      }],
      file_ids: [],
      assistant_id: '',
      run_id: '',
      metadata: {}
    };
    this.threadMessages.push(userMessage);
    return userMessage;
  }

  private get lastMessage() {
    const filteredMessages = this.threadMessages.filter(msg => !msg.id.startsWith('system-') && !msg.id.startsWith('temp-'))
    // Find the last non-system message (from OpenAI)
    const lastMessage = [...(filteredMessages.length > 1 ? this.threadMessages : [])]
      .reverse()
      .find(msg => !msg.id.startsWith('system-') && !msg.id.startsWith('temp-'));
      return lastMessage;
  }

  private async addSystemMessage(content: string) {
    if (!this.threadMessages || !this.threadId) return;

    // Find the most recent non-system message ID
    let lastMessageId = '';
    const messages = this.getMessages(); // This includes streaming messages
    
    // Look for streaming messages first
    for (const [messageId] of this.streamingMessages) {
      lastMessageId = messageId;
      break; // Take the first streaming message ID
    }

    // If no streaming message, find the last assistant or user message
    if (!lastMessageId) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== 'system') {
          lastMessageId = msg.id;
          break;
        }
      }
    }

    // Save to overlay using the message ID we found
    await this.systemMessageOverlayService.addSystemMessage(
      this.threadId,
      content,
      lastMessageId
    );

    // Add to current messages
    this.threadMessages.push({
      id: `system-${Date.now()}`,
      created_at: Date.now(),
      thread_id: this.threadId,
      role: 'system' as const,
      object: 'thread.message',
      content: [{
        type: 'text',
        text: {
          value: content,
          annotations: []
        }
      }],
      file_ids: [],
      assistant_id: '',
      run_id: '',
      metadata: {}
    });
    this.changeDetectorRef.detectChanges();
  }

  public async onSelectAssistant(assistantId: string | undefined): Promise<void> {
    this.assistantId = assistantId;
  }

  public async onSelectThread(threadId: string | undefined): Promise<void> {
    // Clear streaming messages when switching threads
    this.streamingMessages.clear();
    this.completedStreamingMessages.clear();
    
    this.threadId = threadId;
    if (threadId) {
      await this.loadThread(threadId);
    }
  }

  public async onSubmitMessage(message: string): Promise<void> {
    try {
      this.loadingMessage = true;
      this.message = message;
      if (!this.threadId && !this.assistantId) return;

      // Add user message immediately and keep reference
      const userMessage = await this.addUserMessage(message);

      // Create thread if not exists
      if (!this.threadId) {
        // Clear messages except for the user message we just added
        this.threadMessages = [userMessage];
        await this.createThread();
        
        // Update the user message with new thread ID
        userMessage.thread_id = this.threadId!;
      } else {
        await this.fetchThread();
      }

      // Execute submit sequence
      await this.executeSubmitSequence();

      // After response, fetch messages to get proper order
      const { data } = await this.openAiApiService.listThreadMessages(this.thread!);
      const messages = data.sort((a, b) => a.created_at - b.created_at);
      
      // Find the actual user message in thread
      const userThreadMessage = messages.find(m => 
        m.role === 'user' && 
        m.content[0]?.type === 'text' && 
        m.content[0]?.text?.value === message
      );

      if (userThreadMessage) {
        // Replace temp message with actual thread message
        const index = this.threadMessages?.findIndex(m => m.id === userMessage.id) ?? -1;
        if (index >= 0) {
          this.threadMessages[index] = userThreadMessage;
        }
      }

      // Ensure messages are in correct order
      if (this.threadMessages) {
        this.threadMessages.sort((a, b) => a.created_at - b.created_at);
      }

      this.loadingMessage = false;
    } catch (err) {
      console.error(err);
      this.runSubscription?.unsubscribe();
    }
  }

  public async onCancelRun(): Promise<void> {
    if (!this.threadId) return;

    try {
      // Get the current run ID from the service
      const currentRun = await this.aiMessageService.getCurrentRun(this.threadId);
      if (currentRun) {
        await this.aiMessageService.cleanupFailedRun(this.threadId, currentRun.id, 'Run cancelled by user');
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelled',
          detail: 'Assistant run cancelled'
        });
      }
    } catch (error) {
      console.error('Failed to cancel run:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to cancel run'
      });
    }
  }

  private async handleChangeThread(): Promise<void> {
    this.loadingThread = true;
    await this.fetchThread();
    // Updating thread messages
    await this.fetchThreadMessages();
    this.loadingThread = false;
  }

  private async executeSubmitSequence(): Promise<void> {
    this.submitSequence = new Sequence(
      this.generateAIResponse.bind(this),
      this.fetchThreadMessages.bind(this),
    );
    this.submitSequence.onFail(err => {
      this.loadingMessage = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Error while running thread: "${err?.message}"`,
      });
    });
    this.submitSequence.onAbort(() => {
      this.loadingMessage = false
    });
    await this.submitSequence.run();
  }

  private async fetchThread(): Promise<void> {
    this.thread = await this.openAiApiService.getThread(this.threadId!);
  }

  private async fetchThreadMessages(): Promise<void> {
    const { data } = await this.openAiApiService.listThreadMessages(this.thread!);
    // Sort messages by creation time in ascending order (older first, newer last)
    const messages = data.sort((a, b) => a.created_at - b.created_at);
    
    // Get merged messages with system messages
    const mergedMessages = await this.systemMessageOverlayService.mergeSystemMessages(this.thread!.id, messages);
    
    // Keep track of temp messages that haven't been replaced yet
    const tempMessages = this.threadMessages?.filter(m => 
      m.id.startsWith('temp-') && 
      !mergedMessages.some(thread => 
        thread.role === m.role && 
        thread.content[0]?.text?.value === m.content[0]?.text?.value
      )
    ) || [];
    
    // Update existing messages instead of replacing array
    if (!this.threadMessages) {
      this.threadMessages = [...mergedMessages, ...tempMessages].sort((a, b) => a.created_at - b.created_at);
    } else {
      // Create a new map with both merged and temp messages
      const allMessages = new Map<string, OAThreadMessage>();
      
      // Add merged messages first
      for (const message of mergedMessages) {
        allMessages.set(message.id, message);
      }
      
      // Add temp messages that haven't been replaced
      for (const temp of tempMessages) {
        if (!allMessages.has(temp.id)) {
          allMessages.set(temp.id, temp);
        }
      }
      
      // Update the array while maintaining reference
      this.threadMessages.length = 0;
      this.threadMessages.push(...Array.from(allMessages.values()).sort((a, b) => a.created_at - b.created_at));
    }
  }

  // Helper to get thread messages with streaming content
  public getMessages(): OAThreadMessage[] {
    if (!this.threadMessages) return [];
    
    // Create a new array with references to original messages
    const messages = this.threadMessages.map(m => ({ ...m }));
    
    // Only show streaming messages for current thread
    for (const [messageId, content] of this.streamingMessages.entries()) {
      if (!this.threadId) continue;
      
      const existingMessage = messages.find(m => m.id === messageId);
      if (existingMessage) {
        // Update existing message content only
        existingMessage.content = [{
          type: 'text',
          text: { value: content, annotations: [] }
        }];
      } else {
        // Add new streaming message
        messages.push(this.createMessageObject(messageId, content));
      }
    }

    // Add completed streaming messages that haven't been replaced yet
    for (const [messageId, content] of this.completedStreamingMessages.entries()) {
      if (!this.threadId) continue;
      
      const existingMessage = messages.find(m => m.id === messageId);
      if (!existingMessage) {
        // Only add if not already in messages
        messages.push(this.createMessageObject(messageId, content));
      }
    }
    
    return messages;
  }

  private createMessageObject(messageId: string, content: string): OAThreadMessage {
    return {
      id: messageId,
      thread_id: this.threadId!,
      run_id: '',
      assistant_id: this.assistantId || '',
      role: 'assistant' as const,
      content: [{
        type: 'text',
        text: { value: content, annotations: [] }
      }],
      file_ids: [],
      object: 'thread.message',
      created_at: Date.now(),
      metadata: {}
    };
  }

  public async loadThread(threadId: string) {
    this.loadingThread = true;
    try {
      this.threadId = threadId;
      this.thread = await this.openAiApiService.getThread(threadId);
      
      // Get messages from the thread
      const { data } = await this.openAiApiService.listThreadMessages({ id: threadId });
      
      // Sort messages by creation time in ascending order (older first, newer last)
      const messages = data.sort((a, b) => b.created_at - a.created_at).reverse();
      
      // Merge with system messages from overlay
      this.threadMessages = await this.systemMessageOverlayService.mergeSystemMessages(threadId, messages);
      
    } catch (error) {
      console.error('Failed to load thread:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load thread'
      });
    } finally {
      this.loadingThread = false;
    }
  }

  public async deleteThread(threadId: string) {
    try {
      const thread = await this.openAiApiService.getThread(threadId);
      await this.openAiApiService.deleteThread(thread);
      // Clean up system messages when thread is deleted
      await this.systemMessageOverlayService.deleteThreadOverlay(threadId);
      await this.chatSidebarComponent.loadAssistants();
    } catch (error) {
      console.error('Failed to delete thread:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete thread'
      });
    }
  }

  private async createThread(): Promise<void> {
    // Clear streaming messages when creating new thread
    this.streamingMessages.clear();
    this.completedStreamingMessages.clear();
    
    this.thread = await this.openAiApiService.createThread();
    this.threadId = this.thread.id;
    const profile = this.configService.getActiveProfile()!;
    profile.threads.push({ name: `${this.message!.substring(0, 17)}...`, id: this.thread.id, assistantId: this.assistantId! });
    this.configService.updateProfile(profile);

    // Update sidebar synchronously to prevent flashing of old thread
    await this.chatSidebarComponent.loadAssistants();
    await tick(10); // Small delay for UI update
    this.chatSidebarComponent.setSelectedAssistant(this.assistantId!);
    this.chatSidebarComponent.setSelectedThread(this.thread!.id);
  }

  private async generateAIResponse(): Promise<void> {
    try {
      await this.aiMessageService.generateAIResponse({
        message: this.message!,
        assistantId: this.assistantId!,
        threadId: this.threadId
      });
    } catch (err) {
      this.addSystemMessage(`❌ OpenAI API Error: ${err.message}`);
      console.error('Error generating AI response:', err);
      throw err;
    }
  }
}
