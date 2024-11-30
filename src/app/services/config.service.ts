import { Injectable } from '@angular/core';
import { AppConfig, Profile, Project } from '../../lib/entities/AppConfig';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private activeProfile?: Profile;
  private activeProject?: Project;
  private config: AppConfig = {
    version: '0.0.4',
    profiles: []
  };
  private initialized = false;
  private activeProfileSubject = new BehaviorSubject<Profile | undefined>(undefined);
  private activeProjectSubject = new BehaviorSubject<Project | undefined>(undefined);

  constructor() {}

  // Project methods
  public createProject(profileId: string, name: string, description?: string): Project {
    const profile = this.config.profiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Profile not found');

    const project: Project = {
      id: crypto.randomUUID(),
      name,
      description,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    profile.projects = profile.projects || [];
    profile.projects.push(project);
    this.save();
    
    return project;
  }

  public getProjects(profileId: string): Project[] {
    const profile = this.config.profiles.find(p => p.id === profileId);
    return profile?.projects || [];
  }

  public getActiveProject(): Project | undefined {
    if (!this.activeProfile) return undefined;
    return this.activeProfile.projects?.find(p => p.id === this.activeProfile?.activeProjectId);
  }

  public setActiveProject(projectId: string): void {
    if (!this.activeProfile) throw new Error('No active profile');
    
    const project = this.activeProfile.projects?.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');
    
    this.activeProfile.activeProjectId = projectId;
    this.save();
    this.activeProjectSubject.next(project);
  }

  public get activeProject$(): Observable<Project | undefined> {
    return this.activeProjectSubject.asObservable();
  }

  // Profile methods
  public createProfile(profile: Omit<Profile, 'projects'>): void {
    const newProfile: Profile = {
      ...profile,
      projects: [],
      threads: [],
      default: false,
      openai: profile.openai || { apiKey: '' }
    };
    this.config.profiles.push(newProfile);
    this.save();
  }

  public updateProfile(profile: Profile): void {
    this.config.profiles = this.config.profiles.map(p => (p.id === profile.id ? profile : p));
    this.save();
  }

  public deleteProfile(profile: Profile): void {
    this.config.profiles = this.config.profiles.filter(p => p.id !== profile.id);
    this.save();
  }

  public getProfiles(): Profile[] {
    return this.config.profiles;
  }

  public getDefaultProfile(): Profile | undefined {
    return this.config.profiles.find(p => p.default);
  }

  public async initialize(): Promise<any> {
    if (this.initialized) {
      console.log('ConfigService already initialized');
      return;
    }
    
    console.log('Initializing ConfigService...');
    if (await this.configDirExists()) {
      console.log('Config directory exists, loading config...');
      await this.load();
    } else {
      console.log('Config directory does not exist, creating...');
      await this.configDirCreate();
    }

    // Handle profile selection based on number of profiles
    if (this.config.profiles.length === 1) {
      console.log('Single profile found, setting as active...');
      this.activeProfile = this.config.profiles[0];
      
      // Migrate data if needed and create default project
      await this.migrateToFirstProject(this.activeProfile.id);
      
      // Set active project after migration
      const project = this.getActiveProject();
      if (project) {
        this.setActiveProject(project.id);
      }
    } else if (this.config.profiles.length > 1) {
      const defaultProfile = this.getDefaultProfile();
      if (defaultProfile) {
        console.log('Multiple profiles found, using default profile...');
        this.activeProfile = defaultProfile;
        
        // Migrate data if needed and create default project
        await this.migrateToFirstProject(this.activeProfile.id);
        
        // Set active project after migration
        const project = this.getActiveProject();
        if (project) {
          this.setActiveProject(project.id);
        }
      } else {
        console.log('Multiple profiles found, no default set. User selection required.');
        this.activeProfile = undefined;
      }
    } else {
      console.log('No profiles exist. User needs to create one.');
      this.activeProfile = undefined;
    }
    
    console.log('ConfigService initialized with active profile:', this.activeProfile);
    this.initialized = true;
    this.activeProfileSubject.next(this.activeProfile);
    
    // Set active project
    const activeProject = this.getActiveProject();
    if (activeProject) {
      this.activeProjectSubject.next(activeProject);
    }
  }

  // Helper method to migrate existing data to first project
  public async migrateToFirstProject(profileId: string): Promise<void> {
    const profile = this.config.profiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Profile not found');

    // Create default project if none exists
    if (!profile.projects?.length) {
      console.log('Creating default project for migration...');
      const project = this.createProject(profile.id, 'Default Project', 'Migrated from existing data');
      profile.activeProjectId = project.id;
      
      if (window.electron) {
        const configDir = await window.electron.path.appConfigDir();
        
        // Migrate graph data
        const oldGraphPath = await window.electron.path.join(configDir, `graph-${profile.id}.json`);
        const newGraphPath = await window.electron.path.join(configDir, `graph-${profile.id}-${project.id}.json`);
        
        if (await window.electron.fs.exists(oldGraphPath)) {
          console.log('Migrating graph data...');
          const graphData = await window.electron.fs.readTextFile(oldGraphPath);
          await window.electron.fs.writeTextFile(newGraphPath, graphData);
        }

        // Migrate schema data
        const oldSchemaPath = await window.electron.path.join(configDir, `schemas-${profile.id}.json`);
        const newSchemaPath = await window.electron.path.join(configDir, `schemas-${profile.id}-${project.id}.json`);
        
        if (await window.electron.fs.exists(oldSchemaPath)) {
          console.log('Migrating schema data...');
          const schemaData = await window.electron.fs.readTextFile(oldSchemaPath);
          await window.electron.fs.writeTextFile(newSchemaPath, schemaData);
        }

        // Migrate instance data
        const oldInstancePath = await window.electron.path.join(configDir, `instances-${profile.id}.json`);
        const newInstancePath = await window.electron.path.join(configDir, `instances-${profile.id}-${project.id}.json`);
        
        if (await window.electron.fs.exists(oldInstancePath)) {
          console.log('Migrating instance data...');
          const instanceData = await window.electron.fs.readTextFile(oldInstancePath);
          await window.electron.fs.writeTextFile(newInstancePath, instanceData);
        }

        // Migrate assistant data
        console.log('Looking for assistant files to migrate...');
        const files = await window.electron.fs.readdir(configDir);
        const assistantFiles = files.filter(f => f.startsWith(`assistant-${profile.id}-`) && f.endsWith('.json'));
        
        for (const file of assistantFiles) {
          console.log(`Migrating assistant file: ${file}`);
          const oldPath = await window.electron.path.join(configDir, file);
          const assistantData = await window.electron.fs.readTextFile(oldPath);
          
          // Extract assistant ID from filename
          const match = file.match(/assistant-[^-]+-([^.]+)\.json/);
          if (match) {
            const assistantId = match[1];
            const newPath = await window.electron.path.join(configDir, `assistant-${profile.id}-${project.id}-${assistantId}.json`);
            await window.electron.fs.writeTextFile(newPath, assistantData);
            console.log(`Migrated assistant ${assistantId} to project ${project.id}`);
          }
        }
      } else {
        // Handle web storage migration
        const oldGraphData = localStorage.getItem(`graph-${profile.id}`);
        if (oldGraphData) {
          localStorage.setItem(`graph-${profile.id}-${project.id}`, oldGraphData);
        }

        const oldSchemaData = localStorage.getItem(`schemas-${profile.id}`);
        if (oldSchemaData) {
          localStorage.setItem(`schemas-${profile.id}-${project.id}`, oldSchemaData);
        }

        const oldInstanceData = localStorage.getItem(`instances-${profile.id}`);
        if (oldInstanceData) {
          localStorage.setItem(`instances-${profile.id}-${project.id}`, oldInstanceData);
        }
        
        // Migrate assistant data in localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(`assistant-${profile.id}-`)) {
            const data = localStorage.getItem(key);
            if (data) {
              const match = key.match(/assistant-[^-]+-([^.]+)/);
              if (match) {
                const assistantId = match[1];
                const newKey = `assistant-${profile.id}-${project.id}-${assistantId}`;
                localStorage.setItem(newKey, data);
              }
            }
          }
        }
      }

      this.save();
      console.log('Migration completed successfully');
    }
  }

  public get activeProfile$(): Observable<Profile | undefined> {
    return this.activeProfileSubject.asObservable();
  }

  public getActiveProfile(): Profile | undefined {
    if (!this.initialized) {
      console.warn('ConfigService not initialized when getting active profile');
    }
    return this.activeProfile;
  }

  public setActiveProfile(profile: Profile): void {
    if (!this.initialized) {
      console.warn('ConfigService not initialized when setting active profile');
    }
    console.log('Setting active profile:', profile);
    this.activeProfile = profile;
    this.activeProfileSubject.next(profile);
  }

  public setDefaultProfile(profile: Profile): void {
    this.config.profiles = this.config.profiles.map(p => ({ ...p, default: p.id === profile.id }));
    this.save();
  }

  private async configDirCreate(): Promise<void> {
    if (window.electron) {
      const dirPath = await window.electron.path.appConfigDir();
      return window.electron.fs.createDir(dirPath, { recursive: true });
    }
  }

  private async configDirExists(): Promise<boolean> {
    if (window.electron) {
      const dirPath = await window.electron.path.appConfigDir();
      return window.electron.fs.exists(dirPath);
    } else {
      return localStorage.getItem('appConfig') !== null;
    }
  }

  private async load(): Promise<any> {
    if (window.electron) {
      const configPath = await window.electron.path.join(
        await window.electron.path.appConfigDir(),
        'config.json'
      );
      if (await window.electron.fs.exists(configPath)) {
        this.config = JSON.parse(await window.electron.fs.readTextFile(configPath));
      } else {
        await this.save();
      }
    } else {
      const localConfig = localStorage.getItem('appConfig');
      if (localConfig) {
        this.config = JSON.parse(localConfig);
      } else {
        await this.save();
      }
    }
  }

  private async save(): Promise<any> {
    if (window.electron) {
      const configPath = await window.electron.path.join(
        await window.electron.path.appConfigDir(),
        'config.json'
      );
      await window.electron.fs.writeTextFile(configPath, JSON.stringify(this.config));
    } else {
      localStorage.setItem('appConfig', JSON.stringify(this.config));
    }
  }
}