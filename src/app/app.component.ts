import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layouts/header/header.component';
import { MainComponent } from './layouts/main/main.component';
import { AuthService } from './services/auth.service';
import { ConfigService } from './services/config.service';
import { OpenAiApiService } from './services/open-ai-api.service';
import { HttpClientModule } from '@angular/common/http';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    HeaderComponent,
    MainComponent,
    HttpClientModule,
    ToastModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  host: {
    '[class.hasSidebar]': 'hasSidebar'
  }
})
export class AppComponent implements OnInit, OnDestroy {
  public title = 'gpt-assistant-ui';
  public loading = true;
  public hasSidebar = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly openAiApiService: OpenAiApiService,
    private readonly router: Router
  ) { }

  async ngOnInit() {
    this.authService.authSubject.subscribe(this.authObserver.bind(this));
    await this.initializeConfig();
    this.loading = false;
  }

  ngOnDestroy(): void {
    this.authService.authSubject.unsubscribe();
  }

  private async initializeConfig(): Promise<void> {
    await this.configService.initialize();
    const profile = this.configService.getDefaultProfile();
    if (profile) {
      this.openAiApiService.setApiKey(profile.openai.apiKey);
      this.configService.setActiveProfile(profile);
      this.authService.authSubject.next(true);
    } else {
      this.authService.authSubject.next(false);
    }
  }

  private authObserver(authenticated: boolean): void {
    if (!authenticated) {
      this.router.navigate(['/']);
    } else {
      this.router.navigate(['/chat']);
    }
  }
}
