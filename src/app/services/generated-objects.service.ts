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
  content?: any;
  title?: string;
  threadId?: string;
  createdAt: string;
  jobId: string;
  preview?: string;
}

export interface PictoryRender {
  id: string;
  jobId: string;
  preview?: string;
  video?: string;
  thumbnail?: string;
  duration?: number;
  createdAt: string;
}

export interface Video {
  id: string;
  file: string;  // Local file path
  url: string;   // Original URL
  name: string;
  thumbnail: string;
  createdAt: string;
}

export interface StoredObjects {
  outlines: ScriptOutline[];
  scripts: Script[];
  pictoryRequests: PictoryRequest[];
  pictoryRenders: PictoryRender[];
  videos: Video[];
}

@Injectable({
  providedIn: 'root'
})
export class GeneratedObjectsService {
  private outlines$ = new BehaviorSubject<ScriptOutline[]>([]);
  private scripts$ = new BehaviorSubject<Script[]>([]);
  private pictoryRequests$ = new BehaviorSubject<PictoryRequest[]>([]);
  private pictoryRenders$ = new BehaviorSubject<PictoryRender[]>([]);
  private videos$ = new BehaviorSubject<Video[]>([]);

  // Observable streams
  readonly outlines = this.outlines$.asObservable();
  readonly scripts = this.scripts$.asObservable();
  readonly pictoryRequests = this.pictoryRequests$.asObservable();
  readonly pictoryRenders = this.pictoryRenders$.asObservable();
  readonly videos = this.videos$.asObservable();

  constructor(private configService: ConfigService) {
    // Check if we're running in Electron
    console.log('Window electron object:', window.electron);
    console.log('Is electron available?', !!window.electron);
  }

  public async initialize() {
    console.log('Initializing GeneratedObjectsService...');
    await this.loadObjects();
    console.log('GeneratedObjectsService initialized');
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  // Add methods with persistence
  async addOutline(outline: Omit<ScriptOutline, 'id' | 'createdAt'>) {
    const newOutline: ScriptOutline = {
      ...outline,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };
    const current = this.outlines$.getValue();
    this.outlines$.next([...current, newOutline]);
    await this.saveObjects();
  }

  async addScript(script: Omit<Script, 'id' | 'createdAt'>) {
    const newScript: Script = {
      ...script,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };
    const current = this.scripts$.getValue();
    this.scripts$.next([...current, newScript]);
    await this.saveObjects();
  }

  async addPictoryRequest(request: Omit<PictoryRequest, 'id' | 'createdAt'>) {
    const newRequest: PictoryRequest = {
      ...request,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };
    const current = this.pictoryRequests$.getValue();
    this.pictoryRequests$.next([...current, newRequest]);
    await this.saveObjects();
  }

  async addPictoryRender(render: Omit<PictoryRender, 'id' | 'createdAt'>) {
    const newRender: PictoryRender = {
      ...render,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };
    const current = this.pictoryRenders$.getValue();
    this.pictoryRenders$.next([...current, newRender]);
    await this.saveObjects();
  }

  async addVideo(video: Omit<Video, 'id' | 'createdAt'>) {
    const newVideo: Video = {
      ...video,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };
    const current = this.videos$.getValue();
    this.videos$.next([...current, newVideo]);
    await this.saveObjects();
  }

  // Remove individual items
  async removeOutline(id: string) {
    const current = this.outlines$.getValue();
    this.outlines$.next(current.filter(item => item.id !== id));
    await this.saveObjects();
  }

  async removeScript(id: string) {
    const current = this.scripts$.getValue();
    this.scripts$.next(current.filter(item => item.id !== id));
    await this.saveObjects();
  }

  async removePictoryRequest(id: string) {
    const current = this.pictoryRequests$.getValue();
    this.pictoryRequests$.next(current.filter(item => item.id !== id));
    await this.saveObjects();
  }

  async removePictoryRender(id: string) {
    const current = this.pictoryRenders$.getValue();
    this.pictoryRenders$.next(current.filter(item => item.id !== id));
    await this.saveObjects();
  }

  async removeVideo(id: string) {
    const current = this.videos$.getValue();
    this.videos$.next(current.filter(item => item.id !== id));
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

  async clearPictoryRenders() {
    this.pictoryRenders$.next([]);
    await this.saveObjects();
  }

  async clearVideos() {
    this.videos$.next([]);
    await this.saveObjects();
  }

  async clearAll() {
    this.outlines$.next([]);
    this.scripts$.next([]);
    this.pictoryRequests$.next([]);
    this.pictoryRenders$.next([]);
    this.videos$.next([]);
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

  getCurrentPictoryRenders(): PictoryRender[] {
    return this.pictoryRenders$.getValue();
  }

  getCurrentVideos(): Video[] {
    return this.videos$.getValue();
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
        this.pictoryRenders$.next(objects.pictoryRenders || []);
        this.videos$.next(objects.videos || []);
        
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
        pictoryRequests: this.getCurrentPictoryRequests(),
        pictoryRenders: this.getCurrentPictoryRenders(),
        videos: this.getCurrentVideos()
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

  getObjectById(type: keyof StoredObjects, id: string): any {
    const objects = this[`${type}$`].getValue();
    return objects.find(obj => obj.id === id);
  }
}
