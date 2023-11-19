import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layouts/header/header.component';
import { MainComponent } from './layouts/main/main.component';
import { SidebarComponent } from './layouts/sidebar/sidebar.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    MainComponent,
    SidebarComponent,
    RouterModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  host: {
    '[class.hasSidebar]': 'hasSidebar'
  }
})
export class AppComponent implements OnInit, OnDestroy {
  public title = 'gpt-assistant-ui';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.authService.authSubject.subscribe(this.authObserver.bind(this));
  }

  ngOnDestroy() {
    this.authService.authSubject.unsubscribe();
  }

  public hasSidebar(): boolean {
    return this.router.url !== '/';
  }

  private authObserver(authenticated: boolean): void {
    if (!authenticated) this.router.navigate(['/']);
    else this.router.navigate(['/chat']);
  }

}
