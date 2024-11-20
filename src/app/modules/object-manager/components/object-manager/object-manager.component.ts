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
  }
}
