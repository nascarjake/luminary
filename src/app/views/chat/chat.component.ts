import { CommonModule } from '@angular/common';
import { Component, OnDestroy, ViewChild } from '@angular/core';
import { Subscription, interval } from 'rxjs';
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
export class ChatComponent implements OnDestroy {

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

  private addUserMessage(content: string) {
    if (!this.threadMessages) this.threadMessages = [];
    this.threadMessages.push({
      id: `temp-${Date.now()}`,
      created_at: Date.now(),
      thread_id: this.threadId || '',
      role: 'user',
      object: 'thread.message',
      content: [{
        type: 'text',
        text: {
          value: content,
          annotations: []
        }
      }],
      file_ids: [],
      assistant_id: null,
      run_id: null,
      metadata: {}
    });
  }

  private addSystemMessage(content: string) {
    if (!this.threadMessages) this.threadMessages = [];
    this.threadMessages.push({
      id: `system-${Date.now()}`,
      created_at: Date.now(),
      thread_id: this.threadId || '',
      role: 'system',
      object: 'thread.message',
      content: [{
        type: 'text',
        text: {
          value: content,
          annotations: []
        }
      }],
      file_ids: [],
      assistant_id: null,
      run_id: null,
      metadata: {}
    });
  }

  constructor(
    private readonly openAiApiService: OpenAiApiService,
    private readonly configService: ConfigService,
    private readonly aiFunctionService: AiFunctionService,
    private readonly messageService: MessageService,
    private readonly aiMessageService: AiMessageService
  ) {
    // Subscribe to system messages
    this.aiMessageService.systemMessage$.subscribe(message => {
      this.addSystemMessage(message);
    });
  }

  ngOnDestroy(): void {
    this.runSubscription?.unsubscribe();
  }

  public onSelectAssitant(assistantId?: string): void {
    if (this.assistantId === assistantId) return;
    this.submitSequence.abort();
    this.assistantId = assistantId;
  }

  public onSelectThread(threadId?: string): void {
    if (this.threadId === threadId) return;
    this.submitSequence.abort();
    // Reset thread messages
    this.threadMessages = undefined;
    this.threadId = threadId;
    if (threadId) this.handleChangeThread();
  }

  public async onSubmitMessage(message: string): Promise<void> {
    try {
      this.loadingMessage = true;
      this.message = message;
      if (!this.threadId && !this.assistantId) return;

      // Add user message immediately
      this.addUserMessage(message);

      // Create thread if not exists
      if (!this.threadId) await this.createThread();
      else await this.fetchThread();

      // Execute submit sequence
      await this.executeSubmitSequence();
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
    this.threadMessages = data.sort((a, b) => a.created_at > b.created_at ? 1 : -1);
  }

  private async createThread(): Promise<void> {
    this.thread = await this.openAiApiService.createThread();
    this.threadId = this.thread.id;
    const profile = this.configService.getActiveProfile()!;
    profile.threads.push({ name: `${this.message!.substring(0, 17)}...`, id: this.thread.id, assistantId: this.assistantId! });
    this.configService.updateProfile(profile);
    // Do not await for it
    this.chatSidebarComponent.loadAssistants()
      .then(() => tick(100)
        .then(() => {
          this.chatSidebarComponent.setSelectedAssistant(this.assistantId!);
          this.chatSidebarComponent.setSelectedThread(this.thread!.id)
        }));
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
