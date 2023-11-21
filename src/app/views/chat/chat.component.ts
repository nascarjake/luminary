import { CommonModule } from '@angular/common';
import { Component, Input, SimpleChanges } from '@angular/core';
import { ChatBarComponent } from '../../components/chat-bar/chat-bar.component';
import { ChatContentComponent } from '../../components/chat-content/chat-content.component';
import { ChatSidebarComponent } from '../../components/chat-sidebar/chat-sidebar.component';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { OAThread } from '../../../lib/entities/OAThread';
import { OAThreadMessage } from '../../../lib/entities/OAThreadMessage';
import { ConfigService } from '../../services/config.service';
import { OAThreadRun } from '../../../lib/entities/OAThreadRun';
import { Subscription, interval } from 'rxjs';

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

  public assistantId?: string;
  public threadId?: string;
  public threadMessages?: OAThreadMessage[];
  private message?: string;
  private run?: OAThreadRun;
  private thread?: OAThread;
  private runSubscription?: Subscription;

  constructor(
    private readonly openAiApiService: OpenAiApiService,
    private readonly configService: ConfigService,
  ) { }

  public onSelectAssitant(assistantId?: string): void {
    this.assistantId = assistantId;
  }

  public async onSelectThread(threadId?: string): Promise<void> {
    this.threadId = threadId;
    await this.fetchThread();
    this.fetchThreadMessages();
  }

  public async onSubmitMessage(message: string): Promise<void> {
    try {
      this.message = message;
      if (!this.threadId && !this.assistantId) return;
      // Create thread
      if (!this.threadId) await this.createThread();
      else await this.fetchThread();
      // Send message to thread
      await this.createThreadMessage();
      await this.runThread();
      this.fetchThreadMessages();
    } catch (err) {
      console.error(err);
    }
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
    profile.threads.push({ id: this.thread.id, assistantId: this.assistantId! });
    this.configService.updateProfile(profile);
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
      this.runSubscription = interval(500).subscribe(async () => {
        this.run = await this.openAiApiService.runStatus(this.run!);
        if (this.run!.status === 'completed') {
          resolve();
          this.runSubscription!.unsubscribe();
        } else if (!['in_progress', 'queued'].includes(this.run!.status)) {
          reject(this.run);
          this.runSubscription!.unsubscribe();
        }
      });
    });
  }
}
