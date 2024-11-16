import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { PanelModule } from 'primeng/panel';
import { GeneratedObjectsService, ScriptOutline, Script, PictoryRequest } from '../../services/generated-objects.service';

@Component({
  selector: 'app-object-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    TreeModule,
    PanelModule
  ],
  templateUrl: './object-sidebar.component.html',
  styleUrl: './object-sidebar.component.scss'
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
        expanded: true
      };
      this.treeData = [...this.treeData, categoryNode];
    }

    // Update children
    categoryNode.children = items.map((item, index) => ({
      label: item.title || `${type} ${index + 1}`,
      icon: this.getIconForType(type),
      data: { type, item }
    }));

    // Force tree update
    this.treeData = [...this.treeData];
  }

  private getIconForType(type: string): string {
    switch (type) {
      case 'outline':
        return 'pi pi-file-edit';
      case 'script':
        return 'pi pi-file-word';
      case 'pictory':
        return 'pi pi-video';
      default:
        return 'pi pi-file';
    }
  }

  onNodeSelect(event: { node: TreeNode }) {
    if (event.node.data) {
      this.selectedObject = event.node.data.item;
    } else {
      this.selectedObject = null;
    }
  }
}
