import { Component, AfterViewInit, ViewChild, ElementRef, EventEmitter, Output, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { getFirestore } from 'firebase/firestore';
import { collection, addDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-canvas',
  imports: [HttpClientModule, FormsModule, MatTooltipModule],
  templateUrl: './canvas.html',
  styleUrl: './canvas.scss',
  standalone: true
})
export class Canvas implements OnInit, AfterViewInit {
  protected db = getFirestore();
  
  color: string = '#000000';
  brushSize: number = 3;
  mode: 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'text' = 'pen';
  
  tooltipShowDelay = 1000;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('CanvasWrapper') canvasWrapper!: ElementRef<HTMLDivElement>;
  ctx!: CanvasRenderingContext2D;

  drawing = false;
  strokes: any[] = [];
  redoStack: any[] = [];

  @Output() loadingChange = new EventEmitter<boolean>();

  ngOnInit() {
    this.loadingChange.emit(true);
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    canvas.width = this.canvasWrapper.nativeElement.clientWidth;
    canvas.height = this.canvasWrapper.nativeElement.clientHeight;

    this.resizeCanvas();
    this.drawGrid();

    this.listenToCanvas();

    canvas.addEventListener('mousedown', this.start.bind(this));
    canvas.addEventListener('mousemove', this.draw.bind(this));
    canvas.addEventListener('mouseup', this.stop.bind(this));
  }

  start(e: MouseEvent) {
    this.drawing = true;

    this.ctx.beginPath();
    this.ctx.moveTo(e.offsetX, e.offsetY);

    const stroke = {
      points: [{ x: e.offsetX, y: e.offsetY }],
      color: this.color,
      width: this.brushSize
    };

    this.strokes.push(stroke);
  }

  draw(e: MouseEvent) {
    if (!this.drawing) return;

    const currentStroke = this.strokes[this.strokes.length - 1];

    this.ctx.lineTo(e.offsetX, e.offsetY);
    this.ctx.stroke();

    currentStroke.points.push({
      x: e.offsetX,
      y: e.offsetY
    });
  }

  undo() {
    if (!this.strokes.length) return;
    this.redoStack.push(this.strokes.pop());
    this.redraw();
    this.save();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.strokes.push(this.redoStack.pop());
    this.redraw();
    this.save();
  }

  async stop() {
    if (!this.drawing) return;

    this.drawing = false;

    const lastStroke = this.strokes[this.strokes.length - 1];

    await this.saveStroke(lastStroke);
  }

  clear() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.strokes = [];
  }

  async saveStroke(stroke: any) {
    try {
      const strokesRef = collection(this.db, 'canvases', 'defaultCanvas', 'strokes');

      await addDoc(strokesRef, stroke);

    } catch (e) {
      console.error('Error saving stroke:', e);
    }
  }

  async save() {
    return;
    try {
      const strokesRef = collection(this.db, 'canvases', 'defaultCanvas', 'strokes');

      for (const stroke of this.strokes) {
        await addDoc(strokesRef, stroke);
      }

      console.log('Saved to Firestore');
    } catch (e) {
      console.error('Error saving:', e);
    }
}

  async load() {
    try {
      const strokesRef = collection(this.db, 'canvases', 'defaultCanvas', 'strokes');

      const snapshot = await getDocs(strokesRef);

      this.strokes = snapshot.docs.map(doc => doc.data());

      console.log('Loaded strokes:', this.strokes);

      this.redraw();
    } catch (e) {
      console.error('Error loading:', e);
    }
  }
  
  listenToCanvas() {
    const strokesRef = collection(this.db, 'canvases', 'defaultCanvas', 'strokes');

    let isFirstLoad = true;

    onSnapshot(strokesRef, snapshot => {

      if (isFirstLoad) {
        this.strokes = [];
      }

      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const stroke = change.doc.data();

          this.strokes.push(stroke);
          this.drawStroke(stroke);
        }
      });

      if (isFirstLoad) {
        this.loadingChange.emit(false);
        isFirstLoad = false;
      }
    });
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);

    this.strokes.forEach(stroke => {
      this.drawStroke(stroke);
    });
    // this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    
    // this.strokes.forEach(stroke => {
    //   this.ctx.beginPath();
    //   this.ctx.strokeStyle = stroke.color;
    //   this.ctx.lineWidth = stroke.width;

    //   stroke.forEach((p: any, index: number) => {
    //     if (index === 0) {
    //       this.ctx.moveTo(p.x, p.y);
    //     } else {
    //       this.ctx.lineTo(p.x, p.y);
    //     }
    //   });

    //   this.ctx.stroke();
    // });
  }

  drawStroke(stroke: any) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.width;

    stroke.points.forEach((p: any, index: number) => {
      if (index === 0) {
        this.ctx.moveTo(p.x, p.y);
      } else {
        this.ctx.lineTo(p.x, p.y);
      }
    });

    this.ctx.stroke();
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

  addImage(event: any) {

  }

  exportCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const link = document.createElement('a');
    link.download = 'canvas.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;

    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  setColor() { this.ctx.strokeStyle = this.color; }
  setSize() { this.ctx.lineWidth = this.brushSize; }
  setPen() { this.mode = 'pen'; }
  setEraser() { this.mode = 'eraser'; }
  setRect() { this.mode = 'rect'; }
  setCircle() { this.mode = 'circle'; }
  setLine() { this.mode = 'line'; }
  setText() { this.mode = 'text'; }
}
