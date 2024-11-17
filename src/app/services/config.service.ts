import { Injectable } from '@angular/core';
import { AppConfig } from '../../lib/entities/AppConfig';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private activeProfile: AppConfig['profiles'][number] | undefined;
  private config: AppConfig = {
    version: '0.0.1',
    profiles: []
  };

  constructor() {
    this.initialize().catch(error => {
      console.error('Failed to initialize ConfigService:', error);
    });
  }

  public async initialize(): Promise<any> {
    console.log('Initializing ConfigService...');
    if (await this.configDirExists()) {
      console.log('Config directory exists, loading config...');
      await this.load();
    } else {
      console.log('Config directory does not exist, creating...');
      await this.configDirCreate();
    }

    // Set active profile to default profile if not set
    if (!this.activeProfile) {
      console.log('No active profile, setting to default...');
      this.activeProfile = this.getDefaultProfile();
      if (!this.activeProfile && this.config.profiles.length > 0) {
        console.log('No default profile, setting first profile as active...');
        this.activeProfile = this.config.profiles[0];
      } else if (!this.activeProfile) {
        console.log('No profiles exist, creating default profile...');
        const defaultProfile: AppConfig['profiles'][number] = {
          id: crypto.randomUUID(),
          name: 'Default Profile',
          default: true,
          openai: {
            apiKey: ''
          },
          threads: []
        };
        this.createProfile(defaultProfile);
        this.activeProfile = defaultProfile;
      }
    }
    
    console.log('ConfigService initialized with active profile:', this.activeProfile);
  }

  public createProfile(profile: AppConfig['profiles'][number]): void {
    this.config.profiles.push(profile);
    this.save();
  }

  public updateProfile(profile: AppConfig['profiles'][number]): void {
    this.config.profiles = this.config.profiles.map(p => (p.id === profile.id ? profile : p));
    this.save();
  }

  public deleteProfile(profile: AppConfig['profiles'][number]): void {
    this.config.profiles = this.config.profiles.filter(p => p.id !== profile.id);
    this.save();
  }

  public getProfiles(): AppConfig['profiles'] {
    return this.config.profiles;
  }

  public getDefaultProfile(): AppConfig['profiles'][number] | undefined {
    return this.config.profiles.find(p => p.default);
  }

  public getActiveProfile(): AppConfig['profiles'][number] | undefined {
    return this.activeProfile;
  }

  public setDefaultProfile(profile: AppConfig['profiles'][number]): void {
    this.config.profiles = this.config.profiles.map(p => ({ ...p, default: p.id === profile.id }));
    this.save();
  }

  public setActiveProfile(profile: AppConfig['profiles'][number]): void {
    this.activeProfile = profile;
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