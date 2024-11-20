import { z } from 'zod';

// Base field types supported by the system
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

// Media types supported by the system
export type MediaType = 'image' | 'video' | 'audio';

// Field validation rules
export interface ObjectFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: any[];
  items?: ObjectField;
  properties?: ObjectField[];
  mediaType?: MediaType;  // For fields that represent media files
}

// Field definition within a schema
export interface ObjectField {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  isMedia?: boolean;  // Flag to indicate if this field represents a media file
  validation?: ObjectFieldValidation;
}

// Schema definition for an object type
export interface ObjectSchema {
  id: string;
  name: string;
  description?: string;
  fields: ObjectField[];
  version?: number;  // Optional for nested schemas
  createdAt?: string;
  updatedAt?: string;
  isFinalOutput?: boolean;  // Flag to indicate if instances of this schema are final outputs
}

// An instance of an object conforming to a schema
export interface ObjectInstance {
  id: string;
  schemaId: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  isFinalOutput?: boolean;  // Flag to mark instances as final outputs
}

// Collection of objects by schema
export interface ObjectCollection {
  [schemaId: string]: {
    schema: ObjectSchema;
    instances: ObjectInstance[];
  };
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// Service interfaces
export interface IObjectSchemaService {
  createSchema(schema: Omit<ObjectSchema, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<ObjectSchema>;
  updateSchema(id: string, schema: Partial<ObjectSchema>): Promise<ObjectSchema>;
  deleteSchema(id: string): Promise<void>;
  getSchema(id: string): Promise<ObjectSchema | null>;
  listSchemas(): Promise<ObjectSchema[]>;
  validateInstance(schemaId: string, data: any): Promise<ValidationResult>;
}

export interface IObjectInstanceService {
  createInstance(schemaId: string, data: any): Promise<ObjectInstance>;
  updateInstance(id: string, data: Partial<ObjectInstance['data']>): Promise<ObjectInstance>;
  deleteInstance(id: string): Promise<void>;
  getInstance(id: string): Promise<ObjectInstance | null>;
  listInstances(schemaId: string): Promise<ObjectInstance[]>;
  validateInstance(instance: ObjectInstance): Promise<ValidationResult>;
}

// Helper to create a Zod schema from our ObjectSchema
export function createZodSchema(schema: ObjectSchema): z.ZodObject<any> {
  const shape: { [key: string]: z.ZodTypeAny } = {};

  for (const field of schema.fields) {
    let zodField: z.ZodTypeAny;

    switch (field.type) {
      case 'string':
        zodField = z.string();
        if (field.validation?.enum) {
          zodField = z.enum(field.validation.enum.map(String) as [string, ...string[]]);
        }
        if (field.isMedia) {
          zodField = z.string().url();
        }
        if (field.validation?.minLength !== undefined) {
          zodField = (zodField as z.ZodString).min(field.validation.minLength);
        }
        if (field.validation?.maxLength !== undefined) {
          zodField = (zodField as z.ZodString).max(field.validation.maxLength);
        }
        if (field.validation?.pattern) {
          zodField = (zodField as z.ZodString).regex(new RegExp(field.validation.pattern));
        }
        break;
      case 'number':
        zodField = z.number();
        if (field.validation?.min !== undefined) {
          zodField = (zodField as z.ZodNumber).min(field.validation.min);
        }
        if (field.validation?.max !== undefined) {
          zodField = (zodField as z.ZodNumber).max(field.validation.max);
        }
        break;
      case 'boolean':
        zodField = z.boolean();
        break;
      case 'object':
        if (field.validation?.properties) {
          zodField = createZodSchema({
            id: 'nested',
            name: field.name,
            fields: field.validation.properties,
            version: 1  // Default version for nested schemas
          });
        } else {
          zodField = z.record(z.any());
        }
        break;
      case 'array':
        if (field.validation?.items) {
          const itemSchema = createZodSchema({
            id: 'nested',
            name: field.name,
            fields: [field.validation.items],
            version: 1  // Default version for nested schemas
          });
          zodField = z.array(itemSchema);
        } else {
          zodField = z.array(z.any());
        }
        break;
      case 'date':
        zodField = z.string().datetime();
        break;
      default:
        zodField = z.any();
    }

    if (field.required) {
      shape[field.name] = zodField;
    } else {
      shape[field.name] = zodField.optional();
    }
  }

  return z.object(shape);
}

// Helper function to validate data against a schema
export function validateData(schema: ObjectSchema, data: Record<string, any>): ValidationResult {
  try {
    const zodSchema = createZodSchema(schema);
    zodSchema.parse(data);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => e.message)
      };
    }
    return {
      valid: false,
      errors: ['Unknown validation error']
    };
  }
}
