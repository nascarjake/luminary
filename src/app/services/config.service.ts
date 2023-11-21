import { Injectable } from '@angular/core';
import { fs, path } from '@tauri-apps/api';
import { AppConfig } from '../../lib/entities/AppConfig';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private activeProfile: AppConfig['profiles'][number]|undefined;
  private config: AppConfig = {
    version: '0.0.1',
    profiles: []
  };

  constructor() {}

  public async initialize(): Promise<any> {
    if (!await this.configDirExists()) {
      await this.configDirCreate();
    }
    await this.load();
  }

  public createProfile(profile: AppConfig['profiles'][number]): void {
    this.config.profiles.push(profile);
    this.save();
  }

  public updateProfile(profile: AppConfig['profiles'][number]): void {
    this.config.profiles = this.config.profiles.map(p => p.id === profile.id ? profile : p);
    this.save();
  }

  public deleteProfile(profile: AppConfig['profiles'][number]): void {
    this.config.profiles = this.config.profiles.filter(p => p.id !== profile.id);
    this.save();
  }

  public getProfiles(): AppConfig['profiles'] {
    return this.config.profiles;
  }

  public getDefaultProfile(): AppConfig['profiles'][number]|undefined {
    return this.config.profiles.find(p => p.default);
  }

  public getActiveProfile(): AppConfig['profiles'][number]|undefined {
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
    return await fs.createDir(await path.appConfigDir());
  }

  private async configDirExists(): Promise<boolean> {
    return await fs.exists(await path.appConfigDir());
  }

  private async load(): Promise<any> {
    const configPath = await path.join(await path.appConfigDir(), 'config.json');
    if (await fs.exists(configPath)) {
      this.config = JSON.parse(await fs.readTextFile(configPath));
    } else {
      await this.save();
    }
  }

  private async save(): Promise<any> {
    const configPath = await path.join(await path.appConfigDir(), 'config.json');
    await fs.writeTextFile(configPath, JSON.stringify(this.config));
  }
}
