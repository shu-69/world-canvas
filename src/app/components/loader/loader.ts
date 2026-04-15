import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loader',
  imports: [],
  standalone: true,
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
})
export class Loader {
  @Input() loaderText: string = '';
}
