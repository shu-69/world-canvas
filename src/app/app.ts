import { Component, signal, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Canvas } from './components/canvas/canvas';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Loader } from './components/loader/loader';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule, ReactiveFormsModule, Canvas, Loader],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('world-canvas');
  isLoaderActive = signal<boolean>(false);
  loaderText = signal<string>('Please Wait');
    
  constructor(private ngZone: NgZone) {
    // this.showLoader();
  }

  intervalId: any;

  showLoader() {
    // ::todo:: will do this later
    this.isLoaderActive.set(true);

    setTimeout(() => {
      this.isLoaderActive.set(false);
      // alert('Welcome to World Canvas!');
    }, 8000);

    const emojis = [':)', '///', ';)'];
    const baseText = this.loaderText();8
    let index = 0;

    this.intervalId = setInterval(() => {
      this.ngZone.run(() => {
        this.loaderText.set(baseText + ' ' + emojis[index]);
        index = (index + 1) % emojis.length;
      });
    }, 1000);
  }
}
