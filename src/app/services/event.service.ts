import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { BehaviorSubject } from 'rxjs';
import { OpenAiApiService } from './open-ai-api.service';
import { AiMessageService } from './ai-message.service';
import { RRule } from 'rrule';

interface ScheduledEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  rrule?: string;
  extendedProps: {
    type: 'message' | 'object';
    assistantId: string;
    message?: string;
    objectId?: string;
    objectContent?: string;
    status?: 'pending' | 'completed' | 'failed';
    lastRun?: string;
    error?: string;
    completedOccurrences?: string[]; // Array of ISO date strings
  };
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private events = new BehaviorSubject<ScheduledEvent[]>([]);
  events$ = this.events.asObservable();
  private eventTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private openAiApiService: OpenAiApiService,
    private aiMessageService: AiMessageService
  ) {
    // Subscribe to project changes
    this.configService.activeProject$.subscribe(async project => {
      if (project) {
        console.log('🔄 Project changed, reloading events...');
        // Clear existing timers before loading new events
        this.clearAllTimers();
        await this.loadEvents();
        this.initialized = true;
      }
    });

    // Subscribe to profile changes
    this.configService.activeProfile$.subscribe(async profile => {
      if (profile && this.initialized) {
        console.log('🔄 Profile changed, reloading events...');
        // Clear existing timers before loading new events
        this.clearAllTimers();
        await this.loadEvents();
      }
    });
  }

  async getEventsFilePath(): Promise<string> {
    const profile = await this.configService.getActiveProfile();
    const project = await this.configService.getActiveProject();
    
    if (!profile || !project) {
      throw new Error('No active profile or project');
    }
    
    const baseDir = await (window as any).electron.path.appConfigDir();
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

      // Schedule events after loading
      await this.scheduleAllEvents();
    } catch (error) {
      console.error('Error loading events:', error);
      this.events.next([]);
    }
  }

  async saveEvents(events: ScheduledEvent[]): Promise<void> {
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

  public async addEvent(event: ScheduledEvent) {
    console.log('📝 Adding new event:', event);
    const currentEvents = this.events.value;
    currentEvents.push(event);
    await this.saveEvents(currentEvents);

    // Initialize completedOccurrences for recurring events
    if (event.rrule) {
      event.extendedProps.completedOccurrences = [];
    }

    // Schedule the event if it's in the future
    const eventDate = new Date(event.start);
    if (eventDate > new Date()) {
      console.log(`⏳ Scheduling new event for: ${eventDate}`);
      this.scheduleEvent(event, eventDate);
    } else if (!event.rrule || !event.extendedProps.completedOccurrences?.includes(event.start)) {
      console.log(`⚡ New event is in the past, executing immediately`);
      await this.executeEvent(event);
    }
  }

  public async updateEvent(updatedEvent: ScheduledEvent) {
    console.log('✏️ Updating event:', updatedEvent);
    const currentEvents = this.events.value;
    const index = currentEvents.findIndex(e => e.id === updatedEvent.id);
    
    if (index !== -1) {
      // Clear existing timer
      this.clearEventTimer(updatedEvent.id);
      
      // Update the event
      currentEvents[index] = updatedEvent;
      await this.saveEvents(currentEvents);

      // Reschedule if it's a future event
      const eventDate = new Date(updatedEvent.start);
      if (eventDate > new Date()) {
        console.log(`🔄 Rescheduling updated event for: ${eventDate}`);
        this.scheduleEvent(updatedEvent, eventDate);
      }
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    const currentEvents = this.events.value;
    const updatedEvents = currentEvents.filter(e => e.id !== eventId);
    await this.saveEvents(updatedEvents);
    this.clearEventTimer(eventId);
  }

  private async scheduleAllEvents() {
    console.log('🗓️ Scheduling all events...');
    // Clear existing timers
    this.eventTimers.forEach((timer, eventId) => this.clearEventTimer(eventId));
    this.eventTimers.clear();

    const currentEvents = this.events.value;
    const now = new Date();

    for (const event of currentEvents) {
      console.log(`📅 Processing event: ${event.title} (${event.id})`);
      
      if (event.rrule) {
        // Handle recurring events
        const rule = RRule.fromString(event.rrule);
        const nextOccurrence = rule.after(now);
        
        // Get the last occurrence before now
        const lastOccurrence = rule.before(now);
        
        // Initialize completedOccurrences if not exists
        event.extendedProps.completedOccurrences = event.extendedProps.completedOccurrences || [];
        
        if (lastOccurrence && !event.extendedProps.completedOccurrences.includes(lastOccurrence.toISOString())) {
          console.log(`⏰ Found past recurring event that hasn't run: ${event.title} (${lastOccurrence})`);
          // Set the start time to this occurrence before executing
          const originalStart = event.start;
          event.start = lastOccurrence.toISOString();
          await this.executeEvent(event);
          event.start = originalStart;
        }
        
        if (nextOccurrence) {
          console.log(`🔄 Next occurrence for ${event.title}: ${nextOccurrence}`);
          this.scheduleEvent(event, nextOccurrence);
        } else {
          console.log(`⚠️ No future occurrences for recurring event: ${event.title}`);
        }
      } else {
        // Handle single events
        const eventDate = new Date(event.start);
        
        if (eventDate < now && event.extendedProps.status !== 'completed') {
          console.log(`⏰ Found past event that hasn't run: ${event.title} (${eventDate})`);
          await this.executeEvent(event);
        } else if (eventDate >= now) {
          console.log(`⏳ Scheduling future event: ${event.title} for ${eventDate}`);
          this.scheduleEvent(event, eventDate);
        }
      }
    }
  }

  private scheduleEvent(event: ScheduledEvent, date: Date) {
    const now = new Date();
    const delay = date.getTime() - now.getTime();
    
    console.log(`🕐 Scheduling event ${event.title} to run in ${Math.floor(delay / 1000)} seconds`);
    
    const timer = setTimeout(async () => {
      console.log(`⚡ Timer triggered for event: ${event.title}`);
      await this.executeEvent(event);
      
      // If it's a recurring event, schedule the next occurrence
      if (event.rrule) {
        const rule = RRule.fromString(event.rrule);
        const nextOccurrence = rule.after(new Date());
        if (nextOccurrence) {
          console.log(`🔄 Scheduling next occurrence for ${event.title}: ${nextOccurrence}`);
          this.scheduleEvent(event, nextOccurrence);
        }
      }
    }, delay);

    this.eventTimers.set(event.id, timer);
  }

  private async executeEvent(event: ScheduledEvent): Promise<void> {
    console.log(`🚀 Executing event: ${event.title}`);
    console.log('Event details:', {
      id: event.id,
      type: event.extendedProps.type,
      assistantId: event.extendedProps.assistantId,
      message: event.extendedProps.message,
      objectContent: event.extendedProps.objectContent,
      start: event.start,
      rrule: event.rrule
    });

    try {
      if (event.extendedProps?.type === 'message' && event.extendedProps.message) {
        console.log(`📨 Sending message to assistant: ${event.extendedProps.assistantId}`);
        const response = await this.aiMessageService.generateAIResponse({
          message: event.extendedProps.message,
          assistantId: event.extendedProps.assistantId
        });
        console.log('✅ AI response received:', response);
        
        // Initialize arrays if needed
        if (event.rrule) {
          event.extendedProps.completedOccurrences = event.extendedProps.completedOccurrences || [];
        }
        
        // Update completion status
        if (event.rrule) {
          if (!event.extendedProps.completedOccurrences.includes(event.start)) {
            event.extendedProps.completedOccurrences.push(event.start);
          }
        } else {
          event.extendedProps.status = 'completed';
        }
        event.extendedProps.lastRun = new Date().toISOString();
      } else if (event.extendedProps?.type === 'object' && event.extendedProps.objectContent) {
        console.log(`📦 Sending object to assistant: ${event.extendedProps.assistantId}`);
        const response = await this.aiMessageService.generateAIResponse({
          message: event.extendedProps.objectContent,
          assistantId: event.extendedProps.assistantId
        });
        console.log('✅ AI response received:', response);
        
        // Initialize arrays if needed
        if (event.rrule) {
          event.extendedProps.completedOccurrences = event.extendedProps.completedOccurrences || [];
        }
        
        // Update completion status
        if (event.rrule) {
          if (!event.extendedProps.completedOccurrences.includes(event.start)) {
            event.extendedProps.completedOccurrences.push(event.start);
          }
        } else {
          event.extendedProps.status = 'completed';
        }
        event.extendedProps.lastRun = new Date().toISOString();
      }

      // Save updated event status
      await this.saveEvents(this.events.value);
      console.log(`✨ Event ${event.title} completed successfully`);
    } catch (error) {
      console.error('❌ Failed to execute event:', error);
      if (event.rrule) {
        event.extendedProps.error = error.message;
      } else {
        event.extendedProps.status = 'failed';
        event.extendedProps.error = error.message;
      }
      await this.saveEvents(this.events.value);
    }
  }

  private clearEventTimer(eventId: string) {
    const timer = this.eventTimers.get(eventId);
    if (timer) {
      clearTimeout(timer);
      this.eventTimers.delete(eventId);
    }
  }

  private clearAllTimers() {
    console.log('🧹 Clearing all event timers');
    this.eventTimers.forEach((timer, eventId) => this.clearEventTimer(eventId));
    this.eventTimers.clear();
  }
}
