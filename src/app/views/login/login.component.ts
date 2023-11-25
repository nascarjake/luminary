import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ListboxModule } from 'primeng/listbox';
import { FormElementComponent } from '../../components/form-element/form-element.component';
import { AuthService } from '../../services/auth.service';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { ConfigService } from '../../services/config.service';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../../../lib/entities/AppConfig';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    InputTextModule,
    FormsModule,
    ReactiveFormsModule,
    FormElementComponent,
    SelectButtonModule,
    ListboxModule,
    ToastModule
  ],
  providers: [
    MessageService
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  public mode: 'create'|'profile' = this.configService.getProfiles().length ? 'profile' : 'create';
  public profiles = this.configService.getProfiles();
  public selectedProfile?: AppConfig['profiles'][number];
  public registerError = false;
  public registerForm = new FormGroup({
    name: new FormControl('', [
      Validators.required,
      Validators.minLength(3),
    ]),
    apiKey: new FormControl('', [
      Validators.required
    ])
  });

  constructor(
    private readonly openAiApiService: OpenAiApiService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly messageService: MessageService
  ) {}

  public async onSelectProfile(): Promise<void> {
    if (!this.selectedProfile) return;
    this.openAiApiService.setApiKey(this.selectedProfile.openai.apiKey);
    this.configService.setDefaultProfile(this.selectedProfile);
    this.configService.setActiveProfile(this.selectedProfile);
    this.authService.authSubject.next(true);
  }

  public async onSubmitRegisterForm(): Promise<void> {
    this.openAiApiService.setApiKey(this.registerForm.value.apiKey!);
    const validated = await this.validateApiKey();
    if (validated) this.onRegisterSuccess();
    else this.onRegisterFailure();
  }

  public onRegisterSuccess(): void {
    this.authService.authSubject.next(true);
    this.registerProfile();
  }

  public onRegisterFailure(): void {
    this.registerError = true;
    this.authService.authSubject.next(false);
    this.messageService.add({
      severity: 'error',
      summary: 'Invalid API Key',
      detail: 'Please check your API Key and try again.',
    });
  }

  private registerProfile(): void {
    const profile = {
      id: uuid(),
      name: this.registerForm.value.name!,
      default: false,
      openai: {
        apiKey: this.registerForm.value.apiKey!
      },
      threads: []
    };
    this.configService.createProfile(profile);
    this.configService.setDefaultProfile(profile);
    this.configService.setActiveProfile(profile);
  }

  private async validateApiKey(): Promise<boolean> {
    return await this.openAiApiService.validateApiKey();
  }

}
