import { Component, signal, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Canvas } from './components/canvas/canvas';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Loader } from './components/loader/loader';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule, ReactiveFormsModule, Canvas, Loader],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  animations: [
    trigger('footerAnimation', [
      transition(':enter', [
        style({ transform: 'translateY(100%)' }),
        animate('300ms cubic-bezier(0.22, 1, 0.36, 1)', style({ transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms cubic-bezier(0.22, 1, 0.36, 1)', style({ transform: 'translateY(100%)' }))
      ])
    ])
  ]
})
export class App {
  protected readonly title = signal('world-canvas');
  isLoaderActive = signal<boolean>(false);
  loaderText = signal<string>('Please Wait');

  isFooterVisible = signal<boolean>(false);
    
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
    const baseText = this.loaderText();
    let index = 0;

    this.intervalId = setInterval(() => { // ::TODO:: make this simple
      this.ngZone.run(() => {
        this.loaderText.set(baseText + ' ' + emojis[index]);
        index = (index + 1) % emojis.length;
      });
    }, 1000);
  }

  hideLoader() {
    this.isLoaderActive.set(false); 
  }

  loadingChange(event: boolean) {
    this.isLoaderActive.set(event);
    this.isFooterVisible.set(!event);

    if(event){ 
      const emojis = [':)', '///', ';)'];
      const baseText = this.loaderText();
      let index = 0;

      this.intervalId = setInterval(() => { // ::TODO:: make this simple
        this.ngZone.run(() => {
          this.loaderText.set(baseText + ' ' + emojis[index]);
          index = (index + 1) % emojis.length;
        });
      }, 1000);
    } else {
      clearInterval(this.intervalId);
    }

  }

  activityTimeout: any;

  onCanvasActivity() {
    this.hideFooter();
    clearTimeout(this.activityTimeout);
    this.activityTimeout = setTimeout(() => {
      this.showFooter();
    }, 6000); // 3 seconds
  }

  showFooter() { this.isFooterVisible.set(true); }
  hideFooter() { this.isFooterVisible.set(false); }
  toggleFooter() { this.isFooterVisible.update(v => !v); }
}
