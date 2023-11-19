import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenubarModule } from 'primeng/menubar'
import { AuthService } from '../../services/auth.service';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MenubarModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {

  public items: MenuItem[] = [];

  constructor(
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.authService.authSubject.subscribe(this.authObserver.bind(this));
  }

  ngOnDestroy() {
    this.authService.authSubject.unsubscribe();
  }

  private authObserver(authenticated: boolean): void {
    this.items = [];
    if (authenticated) {
      this.items.push({
        label: 'Logout',
        icon: 'pi pi-fw pi-power-off',
        command: () => this.authService.authSubject.next(false)
      });
    }
    this.items.push({
      label: 'Settings',
      icon: 'pi pi-fw pi-cog'
    });
  }
}
