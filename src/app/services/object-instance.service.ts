import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConfigService } from './config.service';
import { ObjectSchemaService } from './object-schema.service';
import { 
  IObjectInstanceService, 
  ObjectInstance,
  ValidationResult,
  ObjectCollection
} from '../interfaces/object-system';
import { v4 as uuidv4 } from 'uuid';

interface StoredInstances {
  version: string;
  instances: ObjectInstance[];
}

@Injectable({
  providedIn: 'root'
})
export class ObjectInstanceService implements IObjectInstanceService {
  private instances$ = new BehaviorSubject<ObjectInstance[]>([]);
  readonly instances = this.instances$.asObservable();
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private schemaService: ObjectSchemaService
  ) {
    // Don't auto-initialize in constructor
  }

  /**
   * Initialize the service. This must be called after ConfigService is ready.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.loadInstances();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ObjectInstanceService:', error);
      throw error;
    }
  }

  private async getInstancesFilePath(): Promise<string> {
    const profile = this.configService.getActiveProfile();
    if (!profile) throw new Error('No active profile');
    
    const configDir = await window.electron.path.appConfigDir();
    return window.electron.path.join(configDir, `instances-${profile.id}.json`);
  }

  private async loadInstances(): Promise<void> {
    try {
      const filePath = await this.getInstancesFilePath();
      console.log('Loading instances from:', filePath);
      
      const exists = await window.electron.fs.exists(filePath);
      if (!exists) {
        console.log('No instances file found, starting with empty array');
        this.instances$.next([]);
        return;
      }

      const content = await window.electron.fs.readTextFile(filePath);
      const stored: StoredInstances = JSON.parse(content);
      console.log('Loaded instances:', stored.instances.length);
      this.instances$.next(stored.instances);
    } catch (error) {
      console.error('Failed to load instances:', error);
      this.instances$.next([]);
    }
  }

  private async saveInstances(): Promise<void> {
    try {
      const filePath = await this.getInstancesFilePath();
      const stored: StoredInstances = {
        version: '1.0',
        instances: this.instances$.value
      };
      
      await window.electron.fs.writeTextFile(filePath, JSON.stringify(stored, null, 2));
    } catch (error) {
      console.error('Failed to save instances:', error);
    }
  }

  private async getAllInstances(): Promise<ObjectInstance[]> {
    return this.instances$.value;
  }

  async createInstance(schemaId: string, data: Record<string, any>): Promise<ObjectInstance> {
    const schema = await this.schemaService.getSchema(schemaId);
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    const now = new Date().toISOString();
    const newInstance: ObjectInstance = {
      id: uuidv4(),
      schemaId,
      data,
      createdAt: now,
      updatedAt: now
    };

    const instances = await this.getAllInstances();
    instances.push(newInstance);
    this.instances$.next(instances);
    await this.saveInstances();

    return newInstance;
  }

  async updateInstance(id: string, data: Record<string, any>): Promise<ObjectInstance> {
    const instances = await this.getAllInstances();
    const index = instances.findIndex(i => i.id === id);
    if (index === -1) {
      throw new Error(`Instance ${id} not found`);
    }

    const oldInstance = instances[index];
    const updatedInstance: ObjectInstance = {
      ...oldInstance,
      data,
      updatedAt: new Date().toISOString()
    };

    instances[index] = updatedInstance;
    this.instances$.next([...instances]);
    await this.saveInstances();

    return updatedInstance;
  }

  async deleteInstance(id: string): Promise<void> {
    const instances = this.instances$.value.filter(i => i.id !== id);
    this.instances$.next(instances);
    await this.saveInstances();
  }

  async getInstance(id: string): Promise<ObjectInstance | null> {
    const instances = this.instances$.value;
    return instances.find(i => i.id === id) || null;
  }

  async getInstances(schemaId: string): Promise<ObjectInstance[]> {
    const instances = this.instances$.value;
    return instances.filter(i => i.schemaId === schemaId);
  }

  async listInstances(schemaId?: string): Promise<ObjectInstance[]> {
    const instances = await this.getAllInstances();
    return schemaId ? instances.filter(i => i.schemaId === schemaId) : instances;
  }

  async validateInstance(instance: ObjectInstance): Promise<ValidationResult> {
    return this.schemaService.validateInstance(instance.schemaId, instance.data);
  }

  // Helper method to get all instances grouped by schema
  async getObjectCollection(): Promise<ObjectCollection> {
    const schemas = await this.schemaService.listSchemas();
    const collection: ObjectCollection = {};

    for (const schema of schemas) {
      const instances = await this.listInstances(schema.id);
      collection[schema.id] = {
        schema,
        instances
      };
    }

    return collection;
  }
}
