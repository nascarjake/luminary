import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConfigService } from './config.service';
import { 
  IObjectSchemaService, 
  ObjectSchema, 
  ValidationResult,
  createZodSchema
} from '../interfaces/object-system';
import { v4 as uuidv4 } from 'uuid';

interface StoredSchemas {
  version: string;
  schemas: ObjectSchema[];
}

@Injectable({
  providedIn: 'root'
})
export class ObjectSchemaService implements IObjectSchemaService {
  private schemas$ = new BehaviorSubject<ObjectSchema[]>([]);
  readonly schemas = this.schemas$.asObservable();

  constructor(private configService: ConfigService) {
    this.initialize().catch(error => {
      console.error('Failed to initialize ObjectSchemaService:', error);
    });
  }

  private async initialize(): Promise<void> {
    await this.loadSchemas();
  }

  private async getSchemasFilePath(): Promise<string> {
    const profile = this.configService.getActiveProfile();
    if (!profile) throw new Error('No active profile');
    
    const configDir = await window.electron.path.appConfigDir();
    return window.electron.path.join(configDir, `schemas-${profile.id}.json`);
  }

  private async loadSchemas(): Promise<void> {
    try {
      const filePath = await this.getSchemasFilePath();
      const exists = await window.electron.fs.exists(filePath);
      
      if (!exists) {
        this.schemas$.next([]);
        return;
      }

      const content = await window.electron.fs.readTextFile(filePath);
      const stored: StoredSchemas = JSON.parse(content);
      this.schemas$.next(stored.schemas);
    } catch (error) {
      console.error('Failed to load schemas:', error);
      this.schemas$.next([]);
    }
  }

  private async saveSchemas(): Promise<void> {
    try {
      const filePath = await this.getSchemasFilePath();
      const stored: StoredSchemas = {
        version: '1.0',
        schemas: this.schemas$.value
      };
      
      await window.electron.fs.writeTextFile(filePath, JSON.stringify(stored, null, 2));
    } catch (error) {
      console.error('Failed to save schemas:', error);
    }
  }

  async createSchema(schema: Omit<ObjectSchema, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<ObjectSchema> {
    const now = new Date().toISOString();
    const newSchema: ObjectSchema = {
      ...schema,
      id: uuidv4(),
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    const schemas = [...this.schemas$.value, newSchema];
    this.schemas$.next(schemas);
    await this.saveSchemas();

    return newSchema;
  }

  async updateSchema(id: string, updates: Partial<ObjectSchema>): Promise<ObjectSchema> {
    const schemas = this.schemas$.value;
    const index = schemas.findIndex(s => s.id === id);
    
    if (index === -1) {
      throw new Error(`Schema not found: ${id}`);
    }

    const oldSchema = schemas[index];
    const updatedSchema: ObjectSchema = {
      ...oldSchema,
      ...updates,
      version: oldSchema.version + 1,
      updatedAt: new Date().toISOString()
    };

    schemas[index] = updatedSchema;
    this.schemas$.next([...schemas]);
    await this.saveSchemas();

    return updatedSchema;
  }

  async deleteSchema(id: string): Promise<void> {
    const schemas = this.schemas$.value.filter(s => s.id !== id);
    this.schemas$.next(schemas);
    await this.saveSchemas();
  }

  async getSchema(id: string): Promise<ObjectSchema | null> {
    return this.schemas$.value.find(s => s.id === id) || null;
  }

  async listSchemas(): Promise<ObjectSchema[]> {
    return this.schemas$.value;
  }

  async validateInstance(schemaId: string, data: any): Promise<ValidationResult> {
    const schema = await this.getSchema(schemaId);
    if (!schema) {
      return {
        valid: false,
        errors: [`Schema not found: ${schemaId}`]
      };
    }

    try {
      const zodSchema = createZodSchema(schema);
      zodSchema.parse(data);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: error.errors?.map((e: any) => e.message) || ['Invalid data']
      };
    }
  }
}
