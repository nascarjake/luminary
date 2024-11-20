import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from './services/auth.service';
import { OpenAiApiService } from './services/open-ai-api.service';
import { ConfigService } from './services/config.service';
import { ObjectSchemaService } from './services/object-schema.service';
import { ObjectInstanceService } from './services/object-instance.service';
import { ObjectMigrationService } from './services/object-migration.service';
import { GeneratedObjectsService } from './services/generated-objects.service';
import { HeaderComponent } from './layouts/header/header.component';
import { MainComponent } from './layouts/main/main.component';
import { ObjectSidebarComponent } from './components/object-sidebar/object-sidebar.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ToastModule,
    HeaderComponent,
    MainComponent,
    ObjectSidebarComponent
  ],
  providers: [
    MessageService,
    AuthService,
    ConfigService,
    ObjectSchemaService,
    ObjectInstanceService,
    ObjectMigrationService,
    GeneratedObjectsService
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
    private readonly objectMigrationService: ObjectMigrationService,
    private readonly objectSchemaService: ObjectSchemaService,
    private readonly objectInstanceService: ObjectInstanceService,
    private readonly generatedObjectsService: GeneratedObjectsService,
    private readonly messageService: MessageService,
    private readonly router: Router
  ) { }

  async ngOnInit() {
    this.authService.authSubject.subscribe(this.authObserver.bind(this));
    await this.initializeConfig();
    await this.initializeObjects();
    this.loading = false;
  }

  ngOnDestroy(): void {
    this.authService.authSubject.unsubscribe();
  }

  private async initializeConfig(): Promise<void> {
    await this.configService.initialize();
    const profile = this.configService.getActiveProfile();
    if (profile) {
      console.log('Setting API key from active profile:', profile.openai.apiKey);
      this.openAiApiService.setApiKey(profile.openai.apiKey);
      this.configService.setActiveProfile(profile);
      this.authService.authSubject.next(true);
    } else {
      console.log('No active profile found - redirecting to login');
      this.authService.authSubject.next(false);
    }
  }

  private async initializeObjects() {
    try {
      // Config service is already initialized by initializeConfig()
      await this.generatedObjectsService.initialize();
      
      // Then initialize schema and instance services
      await this.objectSchemaService.initialize();
      await this.objectInstanceService.initialize();
      
      // Wait for first value from both services
      await firstValueFrom(this.objectSchemaService.schemas);
      await firstValueFrom(this.objectInstanceService.instances);
      
      // Check if migration is needed
      const migrationFlag = await this.getMigrationFlag();
      if (!migrationFlag) {
        // Run migration
        try {
          await this.objectMigrationService.migrateObjects();
          // Set migration flag
          await this.setMigrationFlag();
          // Clean up old files
          await this.cleanupOldFiles();
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Objects migrated successfully.'
          });
        } catch (error) {
          console.error('Failed to migrate objects:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to migrate objects.'
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize objects:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to initialize objects.'
      });
    }
  }

  private async getMigrationFlag(): Promise<boolean> {
    const profile = this.configService.getActiveProfile();
    if (!profile) return false;
    
    const configDir = await window.electron.path.appConfigDir();
    const flagPath = await window.electron.path.join(configDir, `migration-complete-${profile.id}`);
    return window.electron.fs.exists(flagPath);
  }

  private async setMigrationFlag(): Promise<void> {
    const profile = this.configService.getActiveProfile();
    if (!profile) return;
    
    const configDir = await window.electron.path.appConfigDir();
    const flagPath = await window.electron.path.join(configDir, `migration-complete-${profile.id}`);
    await window.electron.fs.writeTextFile(flagPath, new Date().toISOString());
  }

  private async cleanupOldFiles(): Promise<void> {
    const profile = this.configService.getActiveProfile();
    if (!profile) return;
    
    const configDir = await window.electron.path.appConfigDir();
    const oldFiles = [
      `objects-${profile.id}.json`,
    ];
    
    for (const file of oldFiles) {
      const filePath = await window.electron.path.join(configDir, file);
      if (await window.electron.fs.exists(filePath)) {
        await window.electron.fs.removeTextFile(filePath);
      }
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
