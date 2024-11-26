import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { OAThreadMessage } from '../../lib/entities/OAThreadMessage';

@Injectable({
  providedIn: 'root'
})
export class AiCommunicationService {
  // Event emitter for system messages
  private systemMessageSource = new Subject<string>();
  systemMessage$ = this.systemMessageSource.asObservable();

  // Event emitter for routing messages between assistants
  private routeMessageSource = new Subject<{
    message: string;
    assistantId: string;
    threadId?: string;
    initMessage?: string;
  }>();
  routeMessage$ = this.routeMessageSource.asObservable();

  constructor() {
    // Listen for terminal output
    window.electron.ipcRenderer.on('terminal:output', (event: any, data: string) => {
      this.emitSystemMessage(data);
    });
  }

  emitSystemMessage(message: string) {
    this.systemMessageSource.next(message);
  }

  routeMessage(params: {
    message: string;
    assistantId: string;
    threadId?: string;
    initMessage?: string;
  }) {
    this.routeMessageSource.next(params);
  }
}
