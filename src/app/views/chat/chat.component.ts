import { CommonModule } from '@angular/common';
import { Component, OnDestroy, ViewChild } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { OAThread } from '../../../lib/entities/OAThread';
import { OAThreadMessage } from '../../../lib/entities/OAThreadMessage';
import { OAThreadRun } from '../../../lib/entities/OAThreadRun';
import { Sequence } from '../../classes/sequence';
import { ChatBarComponent } from '../../components/chat-bar/chat-bar.component';
import { ChatContentComponent } from '../../components/chat-content/chat-content.component';
import { ChatSidebarComponent } from '../../components/chat-sidebar/chat-sidebar.component';
import { ConfigService } from '../../services/config.service';
import { OpenAiApiService } from '../../services/open-ai-api.service';

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

  constructor(
    private readonly openAiApiService: OpenAiApiService,
    private readonly configService: ConfigService,
  ) { }

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

  private async handleChangeThread(): Promise<void> {
    this.loadingThread = true;
    await this.fetchThread();
    // Updating thread messages
    await this.fetchThreadMessages();
    this.loadingThread = false;
  }

  private async executeSubmitSequence(): Promise<void> {
    this.submitSequence = new Sequence(
      this.createThreadMessage.bind(this),
      this.fetchThreadMessages.bind(this),
      this.runThread.bind(this),
      this.fetchThreadMessages.bind(this),
    );
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
    this.chatSidebarComponent.loadAssistants();
  }

  private async createThreadMessage(): Promise<void> {
    await this.openAiApiService.createThreadMessage(this.thread!, {
      content: this.message!,
      role: 'user',
    });
  }

  private runThread(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      this.run = await this.openAiApiService.runThread(this.thread!, { id: this.assistantId! });
      this.runSubscription = interval(500).subscribe({
        next: async () => {
          this.run = await this.openAiApiService.runStatus(this.run!);
          if (this.run!.status === 'completed') {
            resolve();
            this.runSubscription!.unsubscribe();
          } else if (!['in_progress', 'queued'].includes(this.run!.status)) {
            reject(this.run);
            this.runSubscription!.unsubscribe();
          }
        },
        error: reject
      });
    });
  }
}
