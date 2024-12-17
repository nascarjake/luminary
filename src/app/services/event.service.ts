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
      console.log('Loading events from:', filePath);
      const exists = await (window as any).electron.fs.exists(filePath);
      
      if (!exists) {
        console.log('No events file exists yet');
        this.events.next([]);
        return;
      }

      const content = await (window as any).electron.fs.readTextFile(filePath);
      const events = JSON.parse(content);
      console.log('Loaded events from file:', events.length, 'events');
      this.events.next(events);
    } catch (error) {
      console.error('Error loading events:', error);
      this.events.next([]);
    }
  }

  async saveEvents(events: any[]): Promise<void> {
    try {
      const filePath = await this.getEventsFilePath();
      console.log('Saving events to:', filePath, 'Count:', events.length);
      await (window as any).electron.fs.writeTextFile(
        filePath,
        JSON.stringify(events, null, 2)
      );
      console.log('Events saved successfully');
      this.events.next(events);
    } catch (error) {
      console.error('Error saving events:', error);
    }
  }

  async addEvent(event: any): Promise<void> {
    console.log('Adding new event:', event);
    const currentEvents = this.events.value;
    console.log('Current events before add:', currentEvents.length);
    const updatedEvents = [...currentEvents, event];
    console.log('Updated events after add:', updatedEvents.length);
    await this.saveEvents(updatedEvents);
  }

  async updateEvent(event: any): Promise<void> {
    console.log('Updating event:', event);
    const currentEvents = this.events.value;
    console.log('Current events before update:', currentEvents.length);
    const updatedEvents = currentEvents.map(e => e.id === event.id ? event : e);
    console.log('Events after update:', updatedEvents.length);
    await this.saveEvents(updatedEvents);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const currentEvents = this.events.value;
    const updatedEvents = currentEvents.filter(e => e.id !== eventId);
    await this.saveEvents(updatedEvents);
  }
}
