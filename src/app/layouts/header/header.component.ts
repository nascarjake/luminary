import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenubarModule } from 'primeng/menubar';
import { AuthService } from '../../services/auth.service';
import { MenuItem } from 'primeng/api';
import { OutputListComponent } from '../../components/output-list/output-list.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MenubarModule, OutputListComponent],
  template: `
    <header>
      <p-menubar [model]="items"></p-menubar>
    </header>
    <app-output-list></app-output-list>
  `,
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  @ViewChild(OutputListComponent) outputList!: OutputListComponent;
  public items: MenuItem[] = [];
  private subscription: Subscription;

  constructor(private authService: AuthService) {
    this.subscription = this.authService.authSubject.subscribe(this.authObserver.bind(this));
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private authObserver(authenticated: boolean): void {
    this.items = [];
    
    if (authenticated) {
      this.items.push(
        {
          label: 'Videos',
          icon: 'pi pi-video',
          command: () => {
            this.outputList.show();
          }
        },
        {
          label: 'Logout',
          icon: 'pi pi-sign-out',
          command: () => {
            this.authService.logout();
          }
        }
      );
    }
  }
}
