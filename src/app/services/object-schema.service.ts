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
  private initialized = false;

  constructor(private configService: ConfigService) {
    // Don't auto-initialize in constructor
  }

  /**
   * Initialize the service. This must be called after ConfigService is ready.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.loadSchemas();
      await this.initializeDefaultSchemas();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ObjectSchemaService:', error);
      throw error;
    }
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
      console.log('Loading schemas from:', filePath);
      
      const exists = await window.electron.fs.exists(filePath);
      if (!exists) {
        console.log('No schemas file found, starting with empty array');
        this.schemas$.next([]);
        return;
      }

      const content = await window.electron.fs.readTextFile(filePath);
      const stored: StoredSchemas = JSON.parse(content);
      console.log('Loaded schemas:', stored.schemas.length);
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

  private async initializeDefaultSchemas(): Promise<void> {
    const currentSchemas = this.schemas$.value;
    if (currentSchemas.length > 0) return;

    const defaultSchemas = [
      {
        name: 'ScriptOutline',
        description: 'Outline for a script',
        fields: [
          { name: 'title', type: 'string' as const, description: 'Title of the outline', required: true },
          { name: 'content', type: 'object' as const, description: 'Content of the outline' }
        ]
      },
      {
        name: 'Script',
        description: 'A script generated from an outline',
        fields: [
          { name: 'title', type: 'string' as const, description: 'Title of the script', required: true },
          { name: 'content', type: 'string' as const, description: 'Content of the script', required: true },
          { name: 'threadId', type: 'string' as const, description: 'Associated thread ID', required: true }
        ]
      },
      {
        name: 'PictoryRequest',
        description: 'A request to generate video using Pictory',
        fields: [
          { name: 'title', type: 'string' as const, description: 'Title of the request' },
          { name: 'content', type: 'object' as const, description: 'Content of the request' },
          { name: 'threadId', type: 'string' as const, description: 'Associated thread ID' },
          { name: 'jobId', type: 'string' as const, description: 'Pictory job ID', required: true },
          { name: 'preview', type: 'string' as const, description: 'Preview URL' }
        ]
      },
      {
        name: 'PictoryRender',
        description: 'A rendered video from Pictory',
        fields: [
          { name: 'jobId', type: 'string' as const, description: 'Pictory job ID', required: true },
          { name: 'preview', type: 'string' as const, description: 'Preview URL' },
          { name: 'video', type: 'string' as const, description: 'Video URL' },
          { name: 'thumbnail', type: 'string' as const, description: 'Thumbnail URL' },
          { name: 'duration', type: 'number' as const, description: 'Video duration in seconds' }
        ]
      },
      {
        name: 'Video',
        description: 'A video file',
        fields: [
          { name: 'file', type: 'string' as const, description: 'Local file path', required: true },
          { name: 'url', type: 'string' as const, description: 'Original URL', required: true },
          { name: 'name', type: 'string' as const, description: 'Video name', required: true },
          { name: 'thumbnail', type: 'string' as const, description: 'Thumbnail path', required: true }
        ]
      }
    ];

    for (const schema of defaultSchemas) {
      await this.createSchema(schema);
    }
  }
}
