import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConfigService } from './config.service';

export interface ScriptOutline {
  id: string;
  title?: string;
  createdAt: string;
  [key: string]: any;
}

export interface Script {
  id: string;
  content: string;
  title?: string;
  threadId: string;
  createdAt: string;
}

export interface PictoryRequest {
  id: string;
  content: any;
  title?: string;
  threadId: string;
  createdAt: string;
}

export interface StoredObjects {
  outlines: ScriptOutline[];
  scripts: Script[];
  pictoryRequests: PictoryRequest[];
}

@Injectable({
  providedIn: 'root'
})
export class GeneratedObjectsService {
  private outlines$ = new BehaviorSubject<ScriptOutline[]>([]);
  private scripts$ = new BehaviorSubject<Script[]>([]);
  private pictoryRequests$ = new BehaviorSubject<PictoryRequest[]>([]);

  // Observable streams
  readonly outlines = this.outlines$.asObservable();
  readonly scripts = this.scripts$.asObservable();
  readonly pictoryRequests = this.pictoryRequests$.asObservable();

  constructor(private configService: ConfigService) {
    // Check if we're running in Electron
    console.log('Window electron object:', window.electron);
    console.log('Is electron available?', !!window.electron);
    
    // Wait a bit for ConfigService to initialize
    setTimeout(() => {
      this.initialize().catch(error => {
        console.error('Failed to initialize GeneratedObjectsService:', error);
      });
    }, 1000);
  }

  private async initialize() {
    console.log('Initializing GeneratedObjectsService...');
    await this.loadObjects();
    console.log('GeneratedObjectsService initialized');
  }

  // Add methods with persistence
  async addOutline(outline: Omit<ScriptOutline, 'id' | 'createdAt'>) {
    const newOutline: ScriptOutline = {
      ...outline,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const current = this.outlines$.getValue();
    this.outlines$.next([...current, newOutline]);
    await this.saveObjects();
  }

  async addScript(script: Omit<Script, 'id' | 'createdAt'>) {
    const newScript: Script = {
      ...script,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const current = this.scripts$.getValue();
    this.scripts$.next([...current, newScript]);
    await this.saveObjects();
  }

  async addPictoryRequest(request: Omit<PictoryRequest, 'id' | 'createdAt'>) {
    const newRequest: PictoryRequest = {
      ...request,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const current = this.pictoryRequests$.getValue();
    this.pictoryRequests$.next([...current, newRequest]);
    await this.saveObjects();
  }

  // Clear methods with persistence
  async clearOutlines() {
    this.outlines$.next([]);
    await this.saveObjects();
  }

  async clearScripts() {
    this.scripts$.next([]);
    await this.saveObjects();
  }

  async clearPictoryRequests() {
    this.pictoryRequests$.next([]);
    await this.saveObjects();
  }

  async clearAll() {
    this.outlines$.next([]);
    this.scripts$.next([]);
    this.pictoryRequests$.next([]);
    await this.saveObjects();
  }

  // Get current values
  getCurrentOutlines(): ScriptOutline[] {
    return this.outlines$.getValue();
  }

  getCurrentScripts(): Script[] {
    return this.scripts$.getValue();
  }

  getCurrentPictoryRequests(): PictoryRequest[] {
    return this.pictoryRequests$.getValue();
  }

  // File system operations
  private async loadObjects() {
    try {
      console.log('Loading objects...');
      if (!window.electron) {
        console.warn('Electron not available, skipping object load');
        return;
      }

      const profile = this.configService.getActiveProfile();
      if (!profile) {
        console.warn('No active profile, skipping object load');
        return;
      }

      console.log('Loading objects for profile:', profile.id);
      const objectsPath = await this.getObjectsFilePath(profile.id);
      console.log('Objects path:', objectsPath);

      if (await window.electron.fs.exists(objectsPath)) {
        console.log('Objects file exists, reading content...');
        const content = await window.electron.fs.readTextFile(objectsPath);
        console.log('Raw content:', content);
        const objects: StoredObjects = JSON.parse(content);
        console.log('Parsed objects:', objects);
        
        this.outlines$.next(objects.outlines || []);
        this.scripts$.next(objects.scripts || []);
        this.pictoryRequests$.next(objects.pictoryRequests || []);
        
        console.log('Objects loaded successfully');
      } else {
        console.log('Objects file does not exist yet');
      }
    } catch (error) {
      console.error('Failed to load objects:', error);
    }
  }

  private async saveObjects() {
    try {
      if (!window.electron) {
        console.warn('Electron not available, skipping object save');
        return;
      }

      const profile = this.configService.getActiveProfile();
      if (!profile) {
        console.warn('No active profile, skipping object save');
        return;
      }

      const objectsPath = await this.getObjectsFilePath(profile.id);
      const objects: StoredObjects = {
        outlines: this.getCurrentOutlines(),
        scripts: this.getCurrentScripts(),
        pictoryRequests: this.getCurrentPictoryRequests()
      };

      // Ensure the directory exists
      const dirPath = await window.electron.path.appConfigDir();
      await window.electron.fs.createDir(dirPath, { recursive: true });

      // Save the objects
      await window.electron.fs.writeTextFile(objectsPath, JSON.stringify(objects, null, 2));
    } catch (error) {
      console.error('Failed to save objects:', error);
    }
  }

  private async getObjectsFilePath(profileId: string): Promise<string> {
    if (!window.electron) throw new Error('Electron not available');
    
    const dirPath = await window.electron.path.appConfigDir();
    return window.electron.path.join(dirPath, `objects-${profileId}.json`);
  }
}
