import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiCommunicationService {
  // Event emitter for system messages
  private systemMessageSource = new Subject<string>();
  systemMessage$ = this.systemMessageSource.asObservable();

  constructor() {
    // Listen for terminal output
    window.electron.ipcRenderer.on('terminal:output', (event: any, data: string) => {
      this.emitSystemMessage(data);
    });
  }

  emitSystemMessage(message: string) {
    this.systemMessageSource.next(message);
  }
}
