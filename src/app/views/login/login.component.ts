import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { FormElementComponent } from '../../components/form-element/form-element.component';
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
    private openAiApiService: OpenAiApiService
  ) {}

  public async onSubmit(): Promise<void> {

    this.openAiApiService.setApiKey(this.loginForm.value.apiKey!);

    if (await this.validateApiKey()) {
      console.log('API key is valid');
    } else {
      console.log('API key is invalid');
    }
  }

  private async validateApiKey(): Promise<boolean> {
    return await this.openAiApiService.validateApiKey();
  }

}
