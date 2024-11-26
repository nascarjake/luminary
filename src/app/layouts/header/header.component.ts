import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd, Event } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { TabMenuModule } from 'primeng/tabmenu';
import { AuthService } from '../../services/auth.service';
import { MenuItem } from 'primeng/api';
import { OutputListComponent } from '../../components/output-list/output-list.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MenubarModule, TabMenuModule, OutputListComponent],
  template: `
    <div class="header">
      <div class="main-nav">
        <p-menubar [model]="mainNavItems">
          <ng-template pTemplate="start">
            <div class="logo">
              <span class="logo-text">Luminary</span>
            </div>
          </ng-template>
        </p-menubar>
      </div>
      <div class="sub-nav-container" *ngIf="showSubNav">
        <div class="version-container">
          <div class="version-text">By Jake Clark</div>
          <span class="version-text">v{{version}}</span>
        </div>
        <div class="sub-nav">
          <p-tabMenu [model]="subNavItems" [activeItem]="activeSubNavItem"></p-tabMenu>
        </div>
      </div>
    </div>
    <app-output-list></app-output-list>
  `,
  styles: [`
    .header {
      background-color: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
      padding: 0;
    }

    .main-nav {
      width: 100%;
    }

    .sub-nav-container {
      display: flex;
      width: 100%;
    }

    .version-container {
      width: 161px;
      text-align: center;
      padding: 0.5rem;
    }

    .version-text {
      color: white;
      opacity: 0.7;
      font-size: 0.75rem;
    }

    .sub-nav {
      flex: 1;
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

        .p-menuitem.active {
          .p-menuitem-link {
            background-color: var(--primary-color);
            color: var(--primary-color-text);
            border-radius: 6px;

            .p-menuitem-icon,
            .p-menuitem-text {
              color: var(--primary-color-text);
            }
          }
        }
      }

      .p-tabmenu {
        background: transparent;
        border: none;
        padding: 0 1rem;

        .p-tabmenu-nav {
          border: none;
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
  public mainNavItems: MenuItem[] = [];
  public subNavItems: MenuItem[] = [];
  public activeSubNavItem: MenuItem | null = null;
  public showSubNav: boolean = false;
  public version: string = '';
  private subscription: Subscription;

  constructor(private authService: AuthService, private router: Router) {
    this.subscription = this.authService.authSubject.subscribe(this.authObserver.bind(this));
  }

  async ngOnInit() {
    this.updateMenuItems();
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        this.updateSubNav(event.url);
      }
    });
    
    try {
      this.version = await window.electron.app.getVersion();
    } catch (error) {
      console.error('Failed to get app version:', error);
      this.version = '0.0.0';
    }
  }

  private updateMenuItems(): void {
    this.mainNavItems = [
      {
        label: 'Execute',
        icon: 'pi pi-play',
        command: () => {
          this.handleMainNavClick('execute');
          this.router.navigate(['/chat']);
        },
        styleClass: 'execute-nav-item'
      },
      {
        label: 'Build',
        icon: 'pi pi-wrench',
        command: () => {
          this.handleMainNavClick('build');
          this.router.navigate(['/objects']);
        },
        styleClass: 'build-nav-item'
      },
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        items: [
          {
            label: 'Change Profile',
            icon: 'pi pi-user-edit',
            routerLink: '/'
          }
        ]
      }
    ];
    this.updateActiveStyles();
  }

  private updateActiveStyles(): void {
    this.mainNavItems.forEach(item => {
      if (item.styleClass) {
        item.styleClass = item.styleClass.replace(' active', '');
      }
    });

    const url = this.router.url;
    if (url.includes('chat') || url.includes('outputs')) {
      if (this.mainNavItems[0].styleClass) {
        this.mainNavItems[0].styleClass += ' active';
      }
    } else if (url.includes('objects') || url.includes('assistants') || url.includes('graph')) {
      if (this.mainNavItems[1].styleClass) {
        this.mainNavItems[1].styleClass += ' active';
      }
    }
  }

  private handleMainNavClick(section: string): void {
    this.showSubNav = true;
    switch (section) {
      case 'execute':
        this.subNavItems = [
          {
            label: 'Chat',
            icon: 'pi pi-comments',
            routerLink: '/chat'
          },
          {
            label: 'Outputs',
            icon: 'pi pi-video',
            command: () => {
              this.outputList.show();
            }
          }
        ];
        break;
      case 'build':
        this.subNavItems = [
          {
            label: 'Objects',
            icon: 'pi pi-database',
            routerLink: '/objects'
          },
          {
            label: 'Assistants',
            icon: 'pi pi-user',
            routerLink: '/assistants'
          },
          {
            label: 'Graph',
            icon: 'pi pi-sitemap',
            routerLink: '/graph'
          }
        ];
        break;
      default:
        this.showSubNav = false;
        this.subNavItems = [];
    }
    
    if (this.subNavItems.length > 0) {
      this.activeSubNavItem = this.subNavItems[0];
    }
    this.updateActiveStyles();
  }

  private updateSubNav(url: string): void {
    if (url.includes('chat') || url.includes('outputs')) {
      this.handleMainNavClick('execute');
    } else if (url.includes('objects') || url.includes('assistants') || url.includes('graph')) {
      this.handleMainNavClick('build');
    } else {
      this.showSubNav = false;
      this.subNavItems = [];
    }
    this.updateActiveStyles();
  }

  private authObserver(authenticated: boolean): void {
    if (authenticated) {
      this.updateMenuItems();
    } else {
      this.mainNavItems = [];
      this.subNavItems = [];
      this.showSubNav = false;
      this.activeSubNavItem = null;
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
