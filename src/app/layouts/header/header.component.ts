import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { AuthService } from '../../services/auth.service';
import { MenuItem } from 'primeng/api';
import { OutputListComponent } from '../../components/output-list/output-list.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MenubarModule, OutputListComponent],
  template: `
    <div class="header">
      <p-menubar [model]="items">
        <ng-template pTemplate="start">
          <div class="logo">
            <span class="logo-text">Luminary</span>
          </div>
        </ng-template>
      </p-menubar>
    </div>
    <app-output-list></app-output-list>
  `,
  styles: [`
    .header {
      background-color: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
      padding: 0;
    }

    :host ::ng-deep {
      .p-menubar {
        background: transparent;
        border: none;
        border-radius: 0;
        padding: 0.5rem 1rem;

        .p-menubar-root-list {
          gap: 0.5rem;
        }

        .p-menuitem-link {
          padding: 0.75rem 1.25rem;
        }

        .p-menuitem-icon {
          margin-right: 0.5rem;
        }
      }

      .logo {
        display: flex;
        align-items: center;
        margin-right: 2rem;
        padding: 0 1rem;
      }

      .logo-text {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 500;
        font-size: 1.75rem;
        color: #34D399;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
        letter-spacing: -0.02em;
        cursor: pointer;
        transition: color 0.2s ease;
      }

      .logo-text:hover {
        color: #10B981;
      }
    }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  @ViewChild(OutputListComponent) outputList!: OutputListComponent;
  public items: MenuItem[] = [];
  private subscription: Subscription;

  constructor(private authService: AuthService) {
    this.subscription = this.authService.authSubject.subscribe(this.authObserver.bind(this));
  }

  ngOnInit() {
    this.updateMenuItems();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private updateMenuItems(): void {
    this.items = [
      {
        icon: 'pi pi-comments',
        label: 'Chat',
        routerLink: '/chat'
      },
      {
        icon: 'pi pi-user',
        label: 'Assistants',
        routerLink: '/assistants'
      },
      {
        icon: 'pi pi-database',
        label: 'Objects',
        routerLink: '/objects'
      },
      {
        icon: 'pi pi-video',
        label: 'Videos',
        command: () => {
          this.outputList.show();
        }
      },
      {
        icon: 'pi pi-cog',
        label: 'Settings',
        items: [
          {
            label: 'Change Profile',
            icon: 'pi pi-user-edit',
            routerLink: '/'
          }
        ]
      }
    ];
  }

  private authObserver(authenticated: boolean): void {
    if (authenticated) {
      this.updateMenuItems();
    } else {
      this.items = [];
    }
  }
}
