import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layouts/header/header.component';
import { MainComponent } from './layouts/main/main.component';
import { AuthService } from './services/auth.service';
import { ConfigService } from './services/config.service';
import { OpenAiApiService } from './services/open-ai-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    MainComponent,
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
  public loading = true;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly openAiApiService: OpenAiApiService
  ) {}

  async ngOnInit() {
    this.authService.authSubject.subscribe(this.authObserver.bind(this));
    await this.initializeConfig();
    this.loading = false;
  }

  ngOnDestroy() {
    this.authService.authSubject.unsubscribe();
  }

  private async initializeConfig(): Promise<void> {
    await this.configService.initialize();
    const profile = this.configService.getDefaultProfile();
    if (profile) {
      this.openAiApiService.setApiKey(profile.openai.apiKey);
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
