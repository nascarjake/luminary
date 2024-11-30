import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-title-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './title-bar.component.html',
  styleUrls: ['./title-bar.component.scss']
})
export class TitleBarComponent {
  isMac = window.navigator.platform.toLowerCase().includes('mac');

  minimize() {
    window.electron.window.minimize();
  }

  maximize() {
    window.electron.window.maximize();
  }

  close() {
    window.electron.window.close();
  }
}
