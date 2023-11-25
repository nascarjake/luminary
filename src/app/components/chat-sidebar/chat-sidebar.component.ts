import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { PanelMenuModule } from 'primeng/panelmenu';
import { SkeletonModule } from 'primeng/skeleton';
import { OAAsistant } from '../../../lib/entities/OAAssistant';
import { ConfigService } from '../../services/config.service';
import { OpenAiApiService } from '../../services/open-ai-api.service';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    PanelMenuModule,
    ButtonModule,
    SkeletonModule
  ],
  templateUrl: './chat-sidebar.component.html',
  styleUrl: './chat-sidebar.component.scss'
})
export class ChatSidebarComponent implements OnInit {

  @Output() public onSelectAssitant = new EventEmitter<string|undefined>();
  @Output() public onSelectThread = new EventEmitter<string|undefined>();

  private assistants: OAAsistant[] = [];
  public loading: boolean = true;
  public items: MenuItem[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly openAiApiService: OpenAiApiService,
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

  private async buildMenu(): Promise<void> {
    this.items = this.assistants.map(({ id, name }) => ({
      label: name,
      icon: 'pi pi-fw pi-user',
      items: [
        ...this.configService.getActiveProfile()!.threads.filter(({ assistantId }) => assistantId === id).map(thread => ({
          label: thread.name,
          icon: 'pi pi-fw pi-comment',
          command: () => {
            this.onSelectAssitant.emit(id);
            this.onSelectThread.emit(thread.id);
          }
        })),
        {
          label: 'New thread',
          icon: 'pi pi-fw pi-plus',
          command: () => {
            this.onSelectAssitant.emit(id);
            this.onSelectThread.emit();
          }
        }
      ]
    }));
  }

  private async fetchAssistants(): Promise<void> {
    const { data } = await this.openAiApiService.listAssistants();
    this.assistants = data;
  }

}
