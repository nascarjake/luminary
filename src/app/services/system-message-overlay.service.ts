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
  constructor(private readonly configService: ConfigService) {}

  private async getOverlayFilePath(): Promise<string> {
    const profile = this.configService.getActiveProfile();
    if (!profile) throw new Error('No active profile');
    
    const configDir = await window.electron.path.appConfigDir();
    return window.electron.path.join(configDir, `overlay-${profile.id}.json`);
  }

  private async getOverlays(): Promise<SystemMessageOverlays> {
    try {
      const filePath = await this.getOverlayFilePath();
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
      await window.electron.fs.writeTextFile(filePath, JSON.stringify(overlays, null, 2));
    } catch (error) {
      console.error('Failed to save overlays:', error);
    }
  }

  async addSystemMessage(threadId: string, content: string, insertAfterMessageId: string): Promise<void> {
    const overlays = await this.getOverlays();
    
    if (!overlays[threadId]) {
      overlays[threadId] = {
        threadId,
        systemMessages: []
      };
    }

    overlays[threadId].systemMessages.push({
      content,
      insertAfterMessageId
    });

    await this.saveOverlays(overlays);
  }

  async getSystemMessagesForThread(threadId: string): Promise<SystemMessageOverlay['systemMessages']> {
    const overlays = await this.getOverlays();
    return overlays[threadId]?.systemMessages || [];
  }

  async deleteThreadOverlay(threadId: string): Promise<void> {
    const overlays = await this.getOverlays();
    delete overlays[threadId];
    await this.saveOverlays(overlays);
  }

  async mergeSystemMessages(threadId: string, messages: OAThreadMessage[]): Promise<OAThreadMessage[]> {
    const result: OAThreadMessage[] = [...messages];
    const systemMessages = await this.getSystemMessagesForThread(threadId);
    
    // For each system message, find where it should be inserted and add it
    for (const sysMsg of systemMessages) {
      const parentIndex = result.findIndex(m => m.id === sysMsg.insertAfterMessageId);
      // Skip if we can't find the message to insert after
      if (parentIndex === -1) {
        console.log(`Skipping system message "${sysMsg.content.slice(0, 20)}..." - parent message not found`);
        continue;
      }

      // Find the next user message after the parent
      let insertIndex = parentIndex + 1;
      while (insertIndex < result.length && (result[insertIndex].role === 'system' || result[insertIndex].role === 'assistant')) {
        insertIndex++;
      }

      // If we found a next user message, insert after it
      if (insertIndex < result.length && result[insertIndex].role === 'user') {
        // Find how many system messages we've already inserted after this message
        let offset = 1;
        while (
          insertIndex + offset < result.length && 
          result[insertIndex + offset].role === 'system' &&
          result[insertIndex + offset].id.startsWith('system-')
        ) {
          offset++;
        }

        result.splice(insertIndex + offset, 0, {
          id: `system-${Date.now()}-${Math.random()}`,
          created_at: Date.now(),
          thread_id: threadId,
          role: 'system',
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
        });
      }
    }
    
    return result;
  }
}
