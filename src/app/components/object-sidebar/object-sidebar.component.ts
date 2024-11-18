import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { PrettyJsonPipe } from '../../pipes/pretty-json.pipe';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { GeneratedObjectsService, ScriptOutline, Script, PictoryRequest, PictoryRender, Video } from '../../services/generated-objects.service';

@Component({
  selector: 'app-object-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    TreeModule,
    PanelModule,
    ButtonModule,
    ConfirmDialogModule,
    PrettyJsonPipe,
    TimeAgoPipe
  ],
  providers: [ConfirmationService],
  templateUrl: './object-sidebar.component.html',
  styleUrls: ['./object-sidebar.component.scss']
})
export class ObjectSidebarComponent implements OnInit {
  treeData: TreeNode[] = [];
  selectedNode: TreeNode | null = null;
  selectedObject: any = null;

  constructor(
    private generatedObjects: GeneratedObjectsService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.updateTreeData();
    this.subscribeToObjects();
  }

  private subscribeToObjects() {
    this.generatedObjects.outlines.subscribe(() => this.updateTreeData());
    this.generatedObjects.scripts.subscribe(() => this.updateTreeData());
    this.generatedObjects.pictoryRequests.subscribe(() => this.updateTreeData());
    this.generatedObjects.pictoryRenders.subscribe(() => this.updateTreeData());
    this.generatedObjects.videos.subscribe(() => this.updateTreeData());
  }

  private updateTreeData() {
    const outlines = this.generatedObjects.getCurrentOutlines();
    const scripts = this.generatedObjects.getCurrentScripts();
    const pictoryRequests = this.generatedObjects.getCurrentPictoryRequests();
    const pictoryRenders = this.generatedObjects.getCurrentPictoryRenders();
    const videos = this.generatedObjects.getCurrentVideos();

    this.treeData = [
      {
        label: 'Outlines',
        data: { type: 'outlines' },
        expandedIcon: 'pi pi-folder-open',
        collapsedIcon: 'pi pi-folder',
        children: outlines.map(item => this.createLeafNode(item, 'outlines')),
        expanded: true
      },
      {
        label: 'Scripts',
        data: { type: 'scripts' },
        expandedIcon: 'pi pi-folder-open',
        collapsedIcon: 'pi pi-folder',
        children: scripts.map(item => this.createLeafNode(item, 'scripts')),
        expanded: true
      },
      {
        label: 'Pictory Requests',
        data: { type: 'pictoryRequests' },
        expandedIcon: 'pi pi-folder-open',
        collapsedIcon: 'pi pi-folder',
        children: pictoryRequests.map(item => this.createLeafNode(item, 'pictoryRequests')),
        expanded: true
      },
      {
        label: 'Pictory Renders',
        data: { type: 'pictoryRenders' },
        expandedIcon: 'pi pi-folder-open',
        collapsedIcon: 'pi pi-folder',
        children: pictoryRenders.map(item => this.createLeafNode(item, 'pictoryRenders')),
        expanded: true
      },
      {
        label: 'Videos',
        data: { type: 'videos' },
        expandedIcon: 'pi pi-folder-open',
        collapsedIcon: 'pi pi-folder',
        children: videos.map(item => this.createLeafNode(item, 'videos')),
        expanded: true
      }
    ];
  }

  private createLeafNode(item: any, type: string): TreeNode {
    return {
      label: item.title || item.name || `${item.id}`,
      data: { type: type, id: item.id },
      icon: 'pi pi-file'
    };
  }

  getLocalResourceUrl(filePath: string): string {
    return `local-resource://${filePath}`;
  }

  onNodeSelect(event: any) {
    const node = event.node;
    if (node.data?.id) {
      const parentNode = this.findParentNode(this.treeData, node);
      if (parentNode) {
        this.selectedObject = this.generatedObjects.getObjectById(parentNode.data.type, node.data.id);
        switch(parentNode.data.type){
          case 'videos':
          const video = this.generatedObjects.getObjectById('videos', node.data?.id);
          this.selectedObject = {
            ...video,
            file: this.getLocalResourceUrl(video.file)
          };
          break;
          case 'pictoryRenders':
            const render = this.generatedObjects.getObjectById('pictoryRenders', node.data?.id);
            this.selectedObject = {
              ...render,
              video: render.video ? this.getLocalResourceUrl(render.video) : undefined
            };
            break
        }
      }
    } else {
      this.selectedObject = null;
    }
  }

  private findParentNode(nodes: TreeNode[], targetNode: TreeNode): TreeNode | null {
    for (const node of nodes) {
      if (node.children?.includes(targetNode)) {
        return node;
      }
      if (node.children) {
        const found = this.findParentNode(node.children, targetNode);
        if (found) return found;
      }
    }
    return null;
  }

  async confirmClearType(type: string, label: string) {
    this.confirmationService.confirm({
      message: `Are you sure you want to clear all ${label}?`,
      header: 'Confirm Clear',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        switch (type) {
          case 'outlines':
            this.generatedObjects.clearOutlines();
            break;
          case 'scripts':
            this.generatedObjects.clearScripts();
            break;
          case 'pictoryRequests':
            this.generatedObjects.clearPictoryRequests();
            break;
          case 'pictoryRenders':
            this.generatedObjects.clearPictoryRenders();
            break;
          case 'videos':
            this.generatedObjects.clearVideos();
            
            break;
        }
      }
    });
  }
}
