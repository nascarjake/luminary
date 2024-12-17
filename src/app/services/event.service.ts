import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private events = new BehaviorSubject<any[]>([]);
  events$ = this.events.asObservable();

  constructor(private configService: ConfigService) {}

  async getEventsFilePath(): Promise<string> {
    const baseDir = await (window as any).electron.path.appConfigDir();
    const profile = await this.configService.getActiveProfile();
    const project = await this.configService.getActiveProject();
    
    if (!profile || !project) {
      throw new Error('No active profile or project');
    }

    return (window as any).electron.path.join(
      baseDir,
      `events-${profile.id}-${project.id}.json`
    );
  }

  async loadEvents(): Promise<void> {
    try {
      const filePath = await this.getEventsFilePath();
      const exists = await (window as any).electron.fs.exists(filePath);
      
      if (!exists) {
        this.events.next([]);
        return;
      }

      const content = await (window as any).electron.fs.readTextFile(filePath);
      const events = JSON.parse(content);
      this.events.next(events);
    } catch (error) {
      console.error('Error loading events:', error);
      this.events.next([]);
    }
  }

  async saveEvents(events: any[]): Promise<void> {
    try {
      const filePath = await this.getEventsFilePath();
      await (window as any).electron.fs.writeTextFile(
        filePath,
        JSON.stringify(events, null, 2)
      );
      this.events.next(events);
    } catch (error) {
      console.error('Error saving events:', error);
    }
  }

  async addEvent(event: any): Promise<void> {
    const currentEvents = this.events.value;
    const updatedEvents = [...currentEvents, event];
    await this.saveEvents(updatedEvents);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const currentEvents = this.events.value;
    const updatedEvents = currentEvents.filter(e => e.id !== eventId);
    await this.saveEvents(updatedEvents);
  }
}
