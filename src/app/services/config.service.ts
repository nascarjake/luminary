import { Injectable } from '@angular/core';
import { AppConfig } from '../../lib/entities/AppConfig';

// Use `import()` for dynamic imports
let fs: any, path: any;

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private activeProfile: AppConfig['profiles'][number] | undefined;
  private config: AppConfig = {
    version: '0.0.1',
    profiles: []
  };

  constructor() {}

  public async initialize(): Promise<any> {
    if (await this.configDirExists()) {
      await this.load();
    } else {
      await this.configDirCreate();
    }
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
    if (!fs || !path) {
      await this.loadTauriApis();  // Load Tauri APIs dynamically
    }
    if (fs && path) {
      const dirPath = await path.appConfigDir();
      return fs.createDir(dirPath, { recursive: true });
    }
  }

  private async configDirExists(): Promise<boolean> {
    if (!fs || !path) {
      await this.loadTauriApis();  // Load Tauri APIs dynamically
    }
    if (fs && path) {
      const dirPath = await path.appConfigDir();
      return fs.exists(dirPath);
    } else {
      return localStorage.getItem('appConfig') !== null;
    }
  }

  private async load(): Promise<any> {
    if (!fs || !path) {
      await this.loadTauriApis();  // Load Tauri APIs dynamically
    }
    if (fs && path) {
      const configPath = await path.join(await path.appConfigDir(), 'config.json');
      if (await fs.exists(configPath)) {
        this.config = JSON.parse(await fs.readTextFile(configPath));
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
    if (!fs || !path) {
      await this.loadTauriApis();  // Load Tauri APIs dynamically
    }
    if (fs && path) {
      const configPath = await path.join(await path.appConfigDir(), 'config.json');
      await fs.writeTextFile(configPath, JSON.stringify(this.config));
    } else {
      localStorage.setItem('appConfig', JSON.stringify(this.config));
    }
  }

  // Dynamically import the Tauri APIs
  private async loadTauriApis(): Promise<void> {
    try {
      fs = (await import('@tauri-apps/api/fs')).default;
      path = (await import('@tauri-apps/api/path')).default;
    } catch (error) {
      console.warn('Tauri APIs not found, falling back to localStorage.');
    }
  }
}