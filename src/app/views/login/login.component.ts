import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FormElementComponent } from '../../components/form-element/form-element.component';
import { AuthService } from '../../services/auth.service';
import { OpenAiApiService } from '../../services/open-ai-api.service';
import { ConfigService } from '../../services/config.service';
import { v4 as uuid } from 'uuid';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    InputTextModule,
    FormsModule,
    ReactiveFormsModule,
    FormElementComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  public loginError = false;
  public loginForm = new FormGroup({
    name: new FormControl('', [
      Validators.required
    ]),
    apiKey: new FormControl('', [
      Validators.required
    ])
  });

  constructor(
    private readonly openAiApiService: OpenAiApiService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  public async onSubmit(): Promise<void> {
    this.openAiApiService.setApiKey(this.loginForm.value.apiKey!);
    const validated = await this.validateApiKey();
    if (validated) this.onLoginSuccess();
    else this.onLoginFailure();
  }

  public onLoginSuccess(): void {
    this.authService.authSubject.next(true);
    this.registerProfile();
  }

  public onLoginFailure(): void {
    this.loginError = true;
    this.authService.authSubject.next(false);
  }

  private registerProfile(): void {
    const exists = this.configService.getProfiles().some(({ openai: { apiKey } }) => apiKey === this.loginForm.value.apiKey);
    if (!exists) {
      this.configService.createProfile({
        id: uuid(),
        name: this.loginForm.value.name!,
        default: true,
        openai: {
          apiKey: this.loginForm.value.apiKey!
        }
      });
    } else {
      const profile = this.configService.getProfiles().find(({ openai: { apiKey } }) => apiKey === this.loginForm.value.apiKey)!;
      this.configService.updateProfile({
        ...profile,
        name: this.loginForm.value.name!,
        default: true,
        openai: {
          apiKey: this.loginForm.value.apiKey!
        }
      });
    }
  }

  private async validateApiKey(): Promise<boolean> {
    return await this.openAiApiService.validateApiKey();
  }

}
