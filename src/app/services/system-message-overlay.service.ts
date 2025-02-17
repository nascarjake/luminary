import { Injectable } from '@angular/core';
import { OAThreadMessage } from '../../lib/entities/OAThreadMessage';
import { ConfigService } from './config.service';

interface SystemMessageOverlay {
  threadId: string;
  systemMessages: {
    content: string;
    insertAfterMessageId: string;
  }[];
}

type SystemMessageOverlays = {
  [threadId: string]: SystemMessageOverlay;
};

@Injectable({
  providedIn: 'root'
})
export class SystemMessageOverlayService {
  private overlayLock: Promise<void> = Promise.resolve();
  
  constructor(private readonly configService: ConfigService) {}

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const currentLock = this.overlayLock;
    let releaseLock: () => void;
    
    // Create new lock
    this.overlayLock = new Promise<void>(resolve => {
      releaseLock = resolve;
    });

    // Wait for previous operation to complete
    await currentLock;

    try {
      // Perform the operation
      return await operation();
    } finally {
      // Release the lock
      releaseLock!();
    }
  }

  private async getOverlayFilePath(): Promise<string> {
    const profile = this.configService.getActiveProfile();
    if (!profile) {
      console.warn('No active profile when getting overlay file path');
      return '';
    }
    
    const configDir = await window.electron.path.appConfigDir();
    return window.electron.path.join(configDir, `overlay-${profile.id}.json`);
  }

  private async getOverlays(): Promise<SystemMessageOverlays> {
    try {
      const filePath = await this.getOverlayFilePath();
      if (!filePath) return {};

      const exists = await window.electron.fs.exists(filePath);
      if (!exists) return {};

      const content = await window.electron.fs.readTextFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read overlays:', error);
      return {};
    }
  }

  private async saveOverlays(overlays: SystemMessageOverlays): Promise<void> {
    try {
      const filePath = await this.getOverlayFilePath();
      if (!filePath) return;

      await window.electron.fs.writeTextFile(filePath, JSON.stringify(overlays, null, 2));
    } catch (error) {
      console.error('Failed to save overlays:', error);
    }
  }

  async addSystemMessage(threadId: string, content: string, insertAfterMessageId: string): Promise<void> {
    await this.withLock(async () => {
      if(content == 'Generating...' || content == 'Your request is queued and will be processed shortly.')
        return;
      const overlays = await this.getOverlays();
      
      if (!overlays[threadId]) {
        overlays[threadId] = {
          threadId,
          systemMessages: []
        };
      }
      console.log('Adding system message:', { threadId, content, insertAfterMessageId });
      overlays[threadId].systemMessages.push({
        content,
        insertAfterMessageId
      });

      await this.saveOverlays(overlays);
    });
  }

  async getSystemMessagesForThread(threadId: string): Promise<SystemMessageOverlay['systemMessages']> {
    return this.withLock(async () => {
      const overlays = await this.getOverlays();
      return overlays[threadId]?.systemMessages || [];
    });
  }

  async deleteThreadOverlay(threadId: string): Promise<void> {
    await this.withLock(async () => {
      const overlays = await this.getOverlays();
      delete overlays[threadId];
      await this.saveOverlays(overlays);
    });
  }

  async mergeSystemMessages(threadId: string, messages: OAThreadMessage[]): Promise<OAThreadMessage[]> {
    const result: OAThreadMessage[] = [...messages];
    const systemMessages = await this.getSystemMessagesForThread(threadId);
    
    // For each system message, find where it should be inserted and add it
    for (const sysMsg of systemMessages) {
      const parentIndex = result.findIndex(m => m.id === sysMsg.insertAfterMessageId);
      let insertIndex: number;
      
      // If no insertAfterMessageId is specified, insert after the first message
      if (!sysMsg.insertAfterMessageId || parentIndex === -1) {
        insertIndex = result.length > 0 ? 0 : -1;
      } else {
        // Find the message to insert after
        insertIndex = result.findIndex(m => m.id === sysMsg.insertAfterMessageId);
      }

      // Always insert the system message after the specified insertion point
      const newMessage: OAThreadMessage = {
        id: `system-${Date.now()}-${Math.random()}`,
        created_at: Date.now(),
        thread_id: threadId,
        role: 'system' as const,
        object: 'thread.message',
        content: [{
          type: 'text',
          text: {
            value: sysMsg.content,
            annotations: []
          }
        }],
        file_ids: [],
        assistant_id: null,
        run_id: null,
        metadata: {}
      };

      // If we have a valid insertion point, insert after it
      if (insertIndex >= 0) {
        // Find how many system messages we've already inserted after this message
        let offset = 1;
        while (
          insertIndex + offset < result.length && 
          result[insertIndex + offset].role === 'system' &&
          result[insertIndex + offset].id.startsWith('system-')
        ) {
          offset++;
        }
        result.splice(insertIndex + offset, 0, newMessage);
      } else {
        // If no valid insertion point, add to the start
        result.unshift(newMessage);
      }
    }
    
    return result;
  }
}
