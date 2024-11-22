import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-graph-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="graph-editor-container">
      <div class="graph-canvas">
        <!-- Graph canvas will go here -->
      </div>
    </div>
  `,
  styleUrls: ['./graph-editor.component.scss']
})
export class GraphEditorComponent {
  // Graph functionality will be added here
}
