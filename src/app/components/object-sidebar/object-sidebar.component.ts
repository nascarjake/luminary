import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { PanelModule } from 'primeng/panel';
import { PrettyJsonPipe } from '../../pipes/pretty-json.pipe';
import { GeneratedObjectsService, ScriptOutline, Script, PictoryRequest, PictoryRender, Video } from '../../services/generated-objects.service';

@Component({
  selector: 'app-object-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    TreeModule,
    PanelModule,
    PrettyJsonPipe
  ],
  templateUrl: './object-sidebar.component.html',
  styleUrls: ['./object-sidebar.component.scss']
})
export class ObjectSidebarComponent implements OnInit {
  treeData: TreeNode[] = [];
  selectedNode: TreeNode | null = null;
  selectedObject: any = null;

  constructor(private generatedObjects: GeneratedObjectsService) {}

  ngOnInit() {
    // Subscribe to outlines
    this.generatedObjects.outlines.subscribe(outlines => {
      this.updateTreeData('Outlines', outlines, 'outline');
    });

    // Subscribe to scripts
    this.generatedObjects.scripts.subscribe(scripts => {
      this.updateTreeData('Scripts', scripts, 'script');
    });

    // Subscribe to Pictory requests
    this.generatedObjects.pictoryRequests.subscribe(requests => {
      this.updateTreeData('Pictory Requests', requests, 'pictory');
    });

    // Subscribe to Pictory renders
    this.generatedObjects.pictoryRenders.subscribe(renders => {
      this.updateTreeData('Pictory Renders', renders, 'render');
    });

    // Subscribe to videos
    this.generatedObjects.videos.subscribe(videos => {
      this.updateTreeData('Videos', videos, 'video');
    });
  }

  getLocalResourceUrl(filePath: string): string {
    return `local-resource://${filePath}`;
  }

  private updateTreeData(category: string, items: any[], type: string) {
    // Find or create category node
    let categoryNode = this.treeData.find(node => node.label === category);
    if (!categoryNode) {
      categoryNode = {
        label: category,
        expandedIcon: 'pi pi-folder-open',
        collapsedIcon: 'pi pi-folder',
        children: [],
        data: { type: 'category' }
      };
      this.treeData.push(categoryNode);
    }

    // Update children
    categoryNode.children = items.map(item => ({
      label: item.title || item.id,
      data: { type, id: item.id },
      icon: this.getIconForType(type)
    }));

    // Force tree update
    this.treeData = [...this.treeData];
  }

  private getIconForType(type: string): string {
    switch (type) {
      case 'outline': return 'pi pi-file-edit';
      case 'script': return 'pi pi-file-o';
      case 'pictory': return 'pi pi-images';
      case 'render': return 'pi pi-video';
      case 'video': return 'pi pi-play';
      default: return 'pi pi-file';
    }
  }

  onNodeSelect(event: any) {
    if (event.node.data?.type === 'category') {
      this.selectedObject = null;
      return;
    }

    const id = event.node.data?.id;
    if (!id) return;

    switch (event.node.data?.type) {
      case 'outline':
        this.selectedObject = this.generatedObjects.getObjectById('outlines', id);
        break;
      case 'script':
        this.selectedObject = this.generatedObjects.getObjectById('scripts', id);
        break;
      case 'pictory':
        this.selectedObject = this.generatedObjects.getObjectById('pictoryRequests', id);
        break;
      case 'render':
        const render = this.generatedObjects.getObjectById('pictoryRenders', id);
        this.selectedObject = {
          ...render,
          video: render.video ? this.getLocalResourceUrl(render.video) : undefined
        };
        break;
      case 'video':
        const video = this.generatedObjects.getObjectById('videos', id);
        this.selectedObject = {
          ...video,
          file: this.getLocalResourceUrl(video.file)
        };
        break;
    }
  }
}
