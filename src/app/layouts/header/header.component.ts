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
    <header>
      <p-menubar [model]="items"></p-menubar>
    </header>
    <app-output-list></app-output-list>
  `,
  styles: [`
    :host ::ng-deep {
      .p-menubar {
        padding: 0;
      }

      .p-menubar-start {
        margin-right: 0.5rem;
      }

      .home-button.p-button {
        background: transparent;
        border: none;
        color: var(--text-color);
        
        &:hover {
          background: var(--surface-hover);
        }

        &:focus {
          box-shadow: none;
        }

        .p-button-icon {
          font-size: 1.2rem;
        }
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

  ngOnInit() {}

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private authObserver(authenticated: boolean): void {
    this.items = [];
    
    if (authenticated) {
      this.items.push(
        {
          icon: 'pi pi-home',
          routerLink: '/',
          tooltipOptions: {
            tooltipLabel: 'Home',
            tooltipPosition: 'bottom'
          }
        },
        {
          label: 'Objects',
          icon: 'pi pi-database',
          routerLink: '/objects'
        },
        {
          label: 'Videos',
          icon: 'pi pi-video',
          command: () => {
            this.outputList.show();
          }
        },
        {
          label: 'Settings',
          icon: 'pi pi-cog',
          items: [
            {
              label: 'Logout',
              icon: 'pi pi-sign-out',
              command: () => {
                this.authService.logout();
              }
            }
          ]
        }
      );
    }
  }
}
