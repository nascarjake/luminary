import { Injectable } from '@angular/core';
import { ObjectSchemaService } from './object-schema.service';
import { ObjectInstanceService } from './object-instance.service';
import { GeneratedObjectsService, ScriptOutline, Script, PictoryRequest, PictoryRender, Video } from './generated-objects.service';
import { ObjectSchema } from '../interfaces/object-system';

@Injectable({
  providedIn: 'root'
})
export class ObjectMigrationService {
  constructor(
    private schemaService: ObjectSchemaService,
    private instanceService: ObjectInstanceService,
    private generatedObjectsService: GeneratedObjectsService
  ) {}

  private async createSchemaIfNotExists(schema: Omit<ObjectSchema, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<ObjectSchema> {
    const existingSchemas = await this.schemaService.listSchemas();
    const existing = existingSchemas.find(s => s.name === schema.name);
    if (existing) return existing;
    return this.schemaService.createSchema(schema);
  }

  async migrateOutlines(): Promise<void> {
    // Create schema for outlines
    const schema = await this.createSchemaIfNotExists({
      name: 'ScriptOutline',
      description: 'Outline for a script or content piece',
      fields: [
        {
          name: 'title',
          type: 'string',
          description: 'Title of the outline',
          required: false
        },
        {
          name: 'content',
          type: 'object',
          description: 'Outline content structure',
          required: true
        }
      ]
    });

    // Migrate existing outlines
    const outlines = this.generatedObjectsService.getCurrentOutlines();
    for (const outline of outlines) {
      try {
        await this.instanceService.createInstance(schema.id, {
          title: outline.title,
          content: outline
        });
      } catch (error) {
        console.error(`Failed to migrate outline ${outline.id}:`, error);
      }
    }
  }

  async migrateScripts(): Promise<void> {
    const schema = await this.createSchemaIfNotExists({
      name: 'Script',
      description: 'Generated script content',
      fields: [
        {
          name: 'title',
          type: 'string',
          description: 'Title of the script',
          required: false
        },
        {
          name: 'content',
          type: 'string',
          description: 'Script content',
          required: true
        },
        {
          name: 'threadId',
          type: 'string',
          description: 'ID of the associated chat thread',
          required: true
        }
      ]
    });

    const scripts = this.generatedObjectsService.getCurrentScripts();
    for (const script of scripts) {
      try {
        await this.instanceService.createInstance(schema.id, {
          title: script.title,
          content: script.content,
          threadId: script.threadId
        });
      } catch (error) {
        console.error(`Failed to migrate script ${script.id}:`, error);
      }
    }
  }

  async migratePictoryRequests(): Promise<void> {
    const schema = await this.createSchemaIfNotExists({
      name: 'PictoryRequest',
      description: 'Request for Pictory video generation',
      fields: [
        {
          name: 'title',
          type: 'string',
          description: 'Title of the video',
          required: false
        },
        {
          name: 'content',
          type: 'object',
          description: 'Pictory request content',
          required: false
        },
        {
          name: 'threadId',
          type: 'string',
          description: 'ID of the associated chat thread',
          required: false
        },
        {
          name: 'jobId',
          type: 'string',
          description: 'Pictory job ID',
          required: true
        },
        {
          name: 'preview',
          type: 'string',
          description: 'Preview URL',
          required: false
        }
      ]
    });

    const requests = this.generatedObjectsService.getCurrentPictoryRequests();
    for (const request of requests) {
      try {
        await this.instanceService.createInstance(schema.id, {
          title: request.title,
          content: request.content,
          threadId: request.threadId,
          jobId: request.jobId,
          preview: request.preview
        });
      } catch (error) {
        console.error(`Failed to migrate Pictory request ${request.id}:`, error);
      }
    }
  }

  async migratePictoryRenders(): Promise<void> {
    const schema = await this.createSchemaIfNotExists({
      name: 'PictoryRender',
      description: 'Completed Pictory video render',
      fields: [
        {
          name: 'jobId',
          type: 'string',
          description: 'Pictory job ID',
          required: true
        },
        {
          name: 'preview',
          type: 'string',
          description: 'Preview URL',
          required: false
        },
        {
          name: 'video',
          type: 'string',
          description: 'Video URL',
          required: false
        },
        {
          name: 'thumbnail',
          type: 'string',
          description: 'Thumbnail URL',
          required: false
        },
        {
          name: 'duration',
          type: 'number',
          description: 'Video duration in seconds',
          required: false
        }
      ]
    });

    const renders = this.generatedObjectsService.getCurrentPictoryRenders();
    for (const render of renders) {
      try {
        await this.instanceService.createInstance(schema.id, {
          jobId: render.jobId,
          preview: render.preview,
          video: render.video,
          thumbnail: render.thumbnail,
          duration: render.duration
        });
      } catch (error) {
        console.error(`Failed to migrate Pictory render ${render.id}:`, error);
      }
    }
  }

  async migrateVideos(): Promise<void> {
    const schema = await this.createSchemaIfNotExists({
      name: 'Video',
      description: 'Stored video file',
      fields: [
        {
          name: 'file',
          type: 'string',
          description: 'Local file path',
          required: true
        },
        {
          name: 'url',
          type: 'string',
          description: 'Original URL',
          required: true
        },
        {
          name: 'name',
          type: 'string',
          description: 'Video name',
          required: true
        },
        {
          name: 'thumbnail',
          type: 'string',
          description: 'Thumbnail path',
          required: true
        }
      ]
    });

    const videos = this.generatedObjectsService.getCurrentVideos();
    for (const video of videos) {
      try {
        await this.instanceService.createInstance(schema.id, {
          file: video.file,
          url: video.url,
          name: video.name,
          thumbnail: video.thumbnail
        });
      } catch (error) {
        console.error(`Failed to migrate video ${video.id}:`, error);
      }
    }
  }

  async migrateObjects(): Promise<void> {
    try {
      await this.migrateOutlines();
      await this.migrateScripts();
      await this.migratePictoryRequests();
      await this.migratePictoryRenders();
      await this.migrateVideos();
    } catch (error) {
      console.error('Failed to migrate objects:', error);
      throw error;
    }
  }

  async migrateAll(): Promise<void> {
    await this.migrateOutlines();
    await this.migrateScripts();
    await this.migratePictoryRequests();
    await this.migratePictoryRenders();
    await this.migrateVideos();
  }
}
