import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { PanelMenu, PanelMenuModule } from 'primeng/panelmenu';
import { ListboxModule } from 'primeng/listbox';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { OAAsistant } from '../../../lib/entities/OAAssistant';
import { ConfigService } from '../../services/config.service';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { OAThread } from '../../../lib/entities/OAThread';
import { FormsModule } from '@angular/forms';
import { AppConfig } from '../../../lib/entities/AppConfig';
import { ToastModule } from 'primeng/toast';
import { tick } from '../../../lib/classes/Helper';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    PanelMenuModule,
    ButtonModule,
    SkeletonModule,
    DialogModule,
    ListboxModule,
    FormsModule,
    ToastModule
  ],
  providers: [
    MessageService
  ],
  templateUrl: './chat-sidebar.component.html',
  styleUrl: './chat-sidebar.component.scss'
})
export class ChatSidebarComponent implements OnInit {

  @ViewChild(PanelMenu) public menu!: PanelMenu;
  @Output() public onSelectAssitant = new EventEmitter<string|undefined>();
  @Output() public onSelectThread = new EventEmitter<string|undefined>();

  private assistants: OAAsistant[] = [];
  private activeAssistant?: OAAsistant;
  public loadingDelete: boolean = false
  public selectedThreads: AppConfig['profiles'][number]['threads'] = [];
  public activeThreads: AppConfig['profiles'][number]['threads'] = [];
  public showDeleteDialog: boolean = false;
  public loading: boolean = true;
  public items: MenuItem[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly openAiApiService: OpenAiApiService,
    private readonly messageService: MessageService,
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadAssistants();
  }

  public async loadAssistants(): Promise<void> {
    this.loading = true;
    await this.fetchAssistants();
    await this.buildMenu();
    this.loading = false;
  }

  public setSelectedThread(threadId: string): void {
    const item = this.menu
      .containerViewChild!
      .nativeElement
      .querySelector(`.threadID_${threadId} .p-menuitem-content`) as HTMLElement;

    item.click();
  }

  public setSelectedAssistant(assistantId: string): void {
    const item = this.menu
      .containerViewChild!
      .nativeElement
      .querySelector(`.assistantID_${assistantId}`) as HTMLElement;

    item.click();
  }

  public onClickDelete(): void {
    this.showDeleteDialog = true;
  }

  public onClickDialogDelete(): void {
    this.deleteThreads();
  }

  private async buildMenu(): Promise<void> {
    this.items = this.assistants.map(assistant => ({
      label: assistant.name,
      icon: 'pi pi-fw pi-user',
      styleClass: `assistantID_${assistant.id}`,
      command: () => {
        this.activeAssistant = assistant;
        this.activeThreads = this.configService.getActiveProfile()?.threads.filter(({ assistantId }) => assistantId === assistant.id) ?? [];
      },
      items: [
        ...this.configService.getActiveProfile()!.threads
          .filter(({ assistantId }) => assistantId === assistant.id)
          .map(thread => ({
            styleClass: `threadID_${thread.id}`,
            label: thread.name,
            icon: 'pi pi-fw pi-comment',
            command: () => {
              this.onSelectAssitant.emit(assistant.id);
              this.onSelectThread.emit(thread.id);
            }
          })),
        {
          label: 'New thread',
          icon: 'pi pi-fw pi-plus',
          styleClass: 'newThread',
          command: () => {
            this.onSelectAssitant.emit(assistant.id);
            this.onSelectThread.emit();
          }
        },
        {
          label: 'Delete threads',
          icon: 'pi pi-fw pi-trash',
          styleClass: 'deleteThreads',
          command: this.onClickDelete.bind(this)
        }
      ]
    }));
  }

  private async deleteThreads(): Promise<void> {
    this.loadingDelete = true;
    const profile = this.configService.getActiveProfile()!;
    for (const thread of this.selectedThreads) {
      // If you can't get a thread, it means it's already deleted
      let exists = false;
      try {
        await this.openAiApiService.getThread(thread.id);
        exists = true;
      } catch (err) {
        exists = false;
      }
      try {
        if (exists) await this.openAiApiService.deleteThread(thread as unknown as OAThread);
        profile.threads = profile.threads.filter(({ id }) => id !== thread.id);
        this.activeThreads = this.activeThreads.filter(({ id }) => id !== thread.id);
        this.selectedThreads = this.selectedThreads.filter(({ id }) => id !== thread.id);
      } catch (err) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to delete thread ${thread.name} ${thread.id}`
        });
      }
    }
    this.configService.updateProfile(profile);
    await this.buildMenu();
    await tick(100);
    this.setSelectedAssistant(this.activeAssistant!.id)
    this.onSelectThread.emit();
    this.loadingDelete = false;
  }

  private async fetchAssistants(): Promise<void> {
    const { data } = await this.openAiApiService.listAssistants();
    this.assistants = data;
  }

}
