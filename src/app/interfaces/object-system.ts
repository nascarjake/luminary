import { z } from 'zod';

// Base field types supported by the system
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

// Field validation rules
export interface ObjectFieldValidation {
  required?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: any[];
  items?: ObjectField;
  properties?: ObjectField[];
}

// Field definition within a schema
export interface ObjectField {
  name: string;
  type: FieldType;
  description?: string;
  required?: boolean;
  validation?: ObjectFieldValidation;
}

// Schema definition for an object type
export interface ObjectSchema {
  id: string;
  name: string;
  description?: string;
  fields: ObjectField[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

// An instance of an object conforming to a schema
export interface ObjectInstance {
  id: string;
  schemaId: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
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
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of schema.fields) {
    let zodField: z.ZodTypeAny;

    switch (field.type) {
      case 'string':
        zodField = z.string();
        if (field.validation?.pattern) {
          zodField = z.string().regex(new RegExp(field.validation.pattern));
        }
        if (field.validation?.enum) {
          zodField = z.enum(field.validation.enum.map(String) as [string, ...string[]]);
        }
        break;
      case 'number':
        zodField = z.number();
        if (field.validation?.min !== undefined) {
          zodField = z.number().min(field.validation.min);
        }
        if (field.validation?.max !== undefined) {
          zodField = z.number().max(field.validation.max);
        }
        if (field.validation?.enum && field.validation.enum.length > 0) {
          const literals = field.validation.enum.map(value => z.literal(value));
          if (literals.length === 1) {
            zodField = literals[0];
          } else if (literals.length > 1) {
            const [first, second, ...rest] = literals;
            zodField = z.union([first, second, ...rest]);
          }
        }
        break;
      case 'boolean':
        zodField = z.boolean();
        if (field.validation?.enum && field.validation.enum.length > 0) {
          const literals = field.validation.enum.map(value => z.literal(value));
          if (literals.length === 1) {
            zodField = literals[0];
          } else if (literals.length > 1) {
            const [first, second, ...rest] = literals;
            zodField = z.union([first, second, ...rest]);
          }
        }
        break;
      case 'date':
        zodField = z.string().datetime();
        break;
      case 'array':
        zodField = z.array(z.any());
        if (field.validation?.items) {
          const itemSchema = createZodSchema({ fields: [field.validation.items], id: '', name: '', version: 0, createdAt: '', updatedAt: '' });
          zodField = z.array(itemSchema);
        }
        break;
      case 'object':
        zodField = z.record(z.any());
        if (field.validation?.properties) {
          const propertiesSchema = createZodSchema({ fields: field.validation.properties, id: '', name: '', version: 0, createdAt: '', updatedAt: '' });
          zodField = z.record(propertiesSchema);
        }
        break;
      default:
        zodField = z.any();
    }

    shape[field.name] = field.required ? zodField : zodField.optional();
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
