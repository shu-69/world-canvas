import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-canvas',
  imports: [HttpClientModule, FormsModule],
  templateUrl: './canvas.html',
  styleUrl: './canvas.scss',
  standalone: true
})
export class Canvas implements AfterViewInit {
  color: string = '#000000';
  brushSize: number = 3;
  mode: 'pen' | 'eraser' = 'pen';

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('CanvasWrapper') canvasWrapper!: ElementRef<HTMLDivElement>;
  ctx!: CanvasRenderingContext2D;

  drawing = false;
  strokes: any[] = [];

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    canvas.width = this.canvasWrapper.nativeElement.clientWidth; // window.innerWidth - 0;
    canvas.height = this.canvasWrapper.nativeElement.clientHeight; // window.innerHeight;

    this.resizeCanvas();
    this.drawGrid(); // 👈 ADD THIS

    canvas.addEventListener('mousedown', this.start.bind(this));
    canvas.addEventListener('mousemove', this.draw.bind(this));
    canvas.addEventListener('mouseup', this.stop.bind(this));
  }
  start(e: MouseEvent) {
    this.drawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(e.offsetX, e.offsetY);

    this.strokes.push([{ x: e.offsetX, y: e.offsetY }]);
  }

  draw(e: MouseEvent) {
    if (!this.drawing) return;

    this.ctx.lineTo(e.offsetX, e.offsetY);
    this.ctx.stroke();

    this.strokes[this.strokes.length - 1].push({
      x: e.offsetX,
      y: e.offsetY
    });
  }

  stop() {
    this.drawing = false;
  }

  clear() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.strokes = [];
  }

  save() {
    console.log(this.strokes); // send this to backend
  }

  drawGrid(spacing: number = 25) {
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;

    ctx.fillStyle = '#ccc'; // dot color

    for (let x = 0; x < canvas.width; x += spacing) {
      for (let y = 0; y < canvas.height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  setColor() {
    this.ctx.strokeStyle = this.color;
  }

  setSize() {
    this.ctx.lineWidth = this.brushSize;
  }

  setPen() {
    this.mode = 'pen';
  }

  setEraser() {
    this.mode = 'eraser';
  }

  addImage(event: any) {

  }

  resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;

    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;
  }
}
