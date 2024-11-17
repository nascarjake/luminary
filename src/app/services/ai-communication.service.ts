import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiCommunicationService {
  // Event emitter for system messages
  private systemMessageSource = new Subject<string>();
  systemMessage$ = this.systemMessageSource.asObservable();

  emitSystemMessage(message: string) {
    this.systemMessageSource.next(message);
  }
}
