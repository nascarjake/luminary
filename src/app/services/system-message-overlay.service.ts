import { Injectable } from '@angular/core';
import { OAThreadMessage } from '../../lib/entities/OAThreadMessage';

export interface SystemMessageOverlay {
  threadId: string;
  systemMessages: {
    content: string;
    insertAfterMessageId: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class SystemMessageOverlayService {
  private readonly STORAGE_KEY = 'systemMessageOverlays';

  constructor() {}

  private getOverlays(): Record<string, SystemMessageOverlay> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  private saveOverlays(overlays: Record<string, SystemMessageOverlay>): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(overlays));
  }

  addSystemMessage(threadId: string, content: string, insertAfterMessageId: string): void {
    const overlays = this.getOverlays();
    if (!overlays[threadId]) {
      overlays[threadId] = { threadId, systemMessages: [] };
    }
    overlays[threadId].systemMessages.push({ content, insertAfterMessageId });
    this.saveOverlays(overlays);
  }

  mergeSystemMessages(threadId: string, messages: OAThreadMessage[]): OAThreadMessage[] {
    const result: OAThreadMessage[] = [...messages];
    const systemMessages = this.getSystemMessagesForThread(threadId);
    
    // For each system message, find where it should be inserted and add it
    for (const sysMsg of systemMessages) {
      const insertIndex = result.findIndex(m => m.id === sysMsg.insertAfterMessageId);
      if (insertIndex !== -1) {
        result.splice(insertIndex + 1, 0, {
          id: `sys_${Date.now()}_${Math.random()}`,
          role: 'system',
          content: sysMsg.content,
          created_at: new Date().toISOString(),
          thread_id: threadId,
          assistant_id: null,
          run_id: null,
          file_ids: [],
          metadata: {}
        });
      }
    }
    
    return result;
  }

  getSystemMessagesForThread(threadId: string): SystemMessageOverlay['systemMessages'] {
    const overlays = this.getOverlays();
    return overlays[threadId]?.systemMessages || [];
  }

  deleteThreadOverlay(threadId: string): void {
    const overlays = this.getOverlays();
    delete overlays[threadId];
    this.saveOverlays(overlays);
  }
}
