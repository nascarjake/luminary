import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ObjectMigrationService } from '../../../../services/object-migration.service';

@Component({
  selector: 'app-object-manager',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
  styleUrls: ['./object-manager.component.scss'],
  host: {
    style: 'flex: 1; height: 100%; min-width: 0; display: flex;'
  }
})
export class ObjectManagerComponent implements OnInit {
  constructor(
    private objectMigrationService: ObjectMigrationService,
    private messageService: MessageService
  ) {}

  async ngOnInit() {
  }
}
