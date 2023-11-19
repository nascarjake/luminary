import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FormElementComponent } from '../../components/form-element/form-element.component';
import { AuthService } from '../../services/auth.service';
import { OpenAiApiService } from '../../services/open-ai-api.service';

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
    apiKey: new FormControl('', [
      Validators.required
    ])
  });

  constructor(
    private readonly openAiApiService: OpenAiApiService,
    private readonly authService: AuthService
  ) {}

  public async onSubmit(): Promise<void> {
    this.openAiApiService.setApiKey(this.loginForm.value.apiKey!);
    const validated = await this.validateApiKey();
    if (validated) this.onLoginSuccess();
    else this.onLoginFailure();
  }

  public onLoginSuccess(): void {
    this.authService.authSubject.next(true);
  }

  public onLoginFailure(): void {
    this.loginError = true;
    this.authService.authSubject.next(false);
  }

  private async validateApiKey(): Promise<boolean> {
    return await this.openAiApiService.validateApiKey();
  }

}
