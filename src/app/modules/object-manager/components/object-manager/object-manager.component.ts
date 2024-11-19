import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ObjectMigrationService } from '../../../../services/object-migration.service';

@Component({
  selector: 'app-object-manager',
  template: `
    <div class="flex flex-col gap-4 p-4">
      <router-outlet></router-outlet>
    </div>
  `
})
export class ObjectManagerComponent implements OnInit {
  constructor(
    private objectMigrationService: ObjectMigrationService,
    private messageService: MessageService
  ) {}

  async ngOnInit() {
    try {
      await this.objectMigrationService.migrateObjects();
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Objects migrated successfully.'
      });
    } catch (error) {
      console.error('Failed to migrate objects:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to migrate objects.'
      });
    }
  }
}
