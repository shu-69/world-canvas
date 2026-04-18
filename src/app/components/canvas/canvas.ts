import { Component, AfterViewInit, ViewChild, ElementRef, EventEmitter, Output, OnInit, computed, signal } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { deleteDoc, doc, getFirestore } from 'firebase/firestore';
import { collection, addDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-canvas',
  imports: [HttpClientModule, FormsModule, MatTooltipModule, MatMenuModule],
  templateUrl: './canvas.html',
  styleUrl: './canvas.scss',
  standalone: true,
  animations: [
    trigger('toolbarAnimation', [
      transition(':enter', [
        query('.toolbar button, .toolbar input', [
          style({
            opacity: 0,
            transform: 'translateX(40px)'
          }),
          stagger(-60, [
            animate(
              '200ms cubic-bezier(0.22, 1, 0.36, 1)', // cubic-bezier(0.22, 1, 0.36, 1) // ease-out
              style({
                opacity: 1,
                transform: 'translateX(0)'
              })
            )
          ])
        ])
      ])
    ]),
    trigger('shapeMenuAnim', [ // not using anymore
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('0ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('100ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class Canvas implements OnInit, AfterViewInit {
  protected db = getFirestore();
  
  color: string = '#000000';
  brushSize: number = 6;
  mode: 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'triangle' | 'text' = 'pen';
  showShapes = false;
  startX = 0;
  startY = 0;
  
  tooltipShowDelay = 1000;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('CanvasWrapper') canvasWrapper!: ElementRef<HTMLDivElement>;
  ctx!: CanvasRenderingContext2D;

  drawing = false;
  strokes: any[] = [];
  redoStack: any[] = [];

  toolbarVisible = signal<boolean>(false); // computed(() => this.loadingChange.subscribe((state: boolean) => { return state; })); // computed(() => !this.loader.isLoading());

  cursorMap: Record<string, string> = {
    pen: 'url(/assets/cursor-circle.svg) 12 12, crosshair',
    eraser: 'url(/assets/cursor-circle.svg) 12 12, crosshair',
    text: 'text',
    rect: 'crosshair',
    circle: 'crosshair',
    line: 'crosshair',
    default: 'url(/assets/cursor-arrow.svg) 0 0, auto'
  };

  @Output() loadingChange = new EventEmitter<boolean>();
  @Output() onActivity = new EventEmitter<void>();

  ngOnInit() {
    this.loadingChange.emit(true);
    // this.clearFirestore();
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    canvas.width = this.canvasWrapper.nativeElement.clientWidth;
    canvas.height = this.canvasWrapper.nativeElement.clientHeight;

    this.resizeCanvas();
    this.drawGrid();

    this.listenToCanvas();
    this.setCursor('pen');

    canvas.addEventListener('mousedown', this.start.bind(this));
    canvas.addEventListener('mousemove', this.draw.bind(this));
    canvas.addEventListener('mouseup', this.stop.bind(this));
  }

  currentStroke: any = null;

  start(e: MouseEvent) {
    this.drawing = true;
    this.onActivity.emit();
    this.startX = e.offsetX;
    this.startY = e.offsetY;
    this.ctx.beginPath();
    this.ctx.moveTo(e.offsetX, e.offsetY);

    this.currentStroke = {
      type: this.mode,
      points: [{ x: e.offsetX, y: e.offsetY }],
      color: this.color,
      width: this.brushSize
    };
  }

  draw(e: MouseEvent) {
    if (!this.drawing) return;
    this.onActivity.emit();
    this.currentStroke.points.push({ x: e.offsetX, y: e.offsetY });

    if (this.mode === 'pen') {
      this.ctx.lineTo(e.offsetX, e.offsetY);
      this.ctx.stroke();
    } else {
      this.redraw();
      this.drawShapePreview(this.startX, this.startY, e.offsetX, e.offsetY);
    }
  }

  drawShapePreview(x1: number, y1: number, x2: number, y2: number) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.brushSize;

    if (this.mode === 'rect') {
      this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (this.mode === 'circle') {
      const rx = (x2 - x1) / 2;
      const ry = (y2 - y1) / 2;
      this.ctx.ellipse(x1 + rx, y1 + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (this.mode === 'line') {
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    } else if (this.mode === 'triangle') {
      this.ctx.moveTo(x1 + (x2 - x1) / 2, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.lineTo(x1, y2);
      this.ctx.closePath();
      this.ctx.stroke();
    }
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
    await this.saveStroke(this.currentStroke);
    this.currentStroke = null;
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
  
  // listenToCanvas() {
  //   const strokesRef = collection(this.db, 'canvases', 'defaultCanvas', 'strokes');

  //   let isFirstLoad = true;

  //   onSnapshot(strokesRef, snapshot => {

  //     if (isFirstLoad) {
  //       this.strokes = [];
  //     }

  //     snapshot.docChanges().forEach(change => {
  //       if (change.type === 'added') {
  //         const stroke = change.doc.data();

  //         this.strokes.push(stroke);
  //         this.drawStroke(stroke);
  //       }
  //     });

  //     if (isFirstLoad) {
  //       this.loadingChange.emit(false);
  //       isFirstLoad = false;
  //       this.toolbarVisible.set(true);
  //     }
  //   });
  // }

  listenToCanvas() {
    const strokesRef = collection(this.db, 'canvases', 'defaultCanvas', 'strokes');
    let isFirstLoad = true;

    onSnapshot(strokesRef, snapshot => {
      this.strokes = snapshot.docs.map(doc => doc.data());
      this.redraw();

      if (isFirstLoad) {
        this.loadingChange.emit(false);
        isFirstLoad = false;
        this.toolbarVisible.set(true);
      }
    });
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    this.drawGrid();
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

    const pts = stroke.points;
    const x1 = pts[0].x;
    const y1 = pts[0].y;
    const x2 = pts[pts.length - 1].x;
    const y2 = pts[pts.length - 1].y;

    if (!stroke.type || stroke.type === 'pen') {
      pts.forEach((p: any, i: number) => {
        if (i === 0) this.ctx.moveTo(p.x, p.y);
        else this.ctx.lineTo(p.x, p.y);
      });
      this.ctx.stroke();
    } else {
      this.ctx.strokeStyle = stroke.color;
      this.ctx.lineWidth = stroke.width;
      const savedMode = this.mode;
      this.mode = stroke.type;
      this.drawShapePreview(x1, y1, x2, y2);
      this.mode = savedMode;
    }
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

  async clearFirestore() {
    const strokesRef = collection(this.db, 'canvases', 'defaultCanvas', 'strokes');
    const snapshot = await getDocs(strokesRef);
    const deletes = snapshot.docs.map(d => deleteDoc(doc(this.db, 'canvases', 'defaultCanvas', 'strokes', d.id)));
    await Promise.all(deletes);
  }

  setCursor(mode: string, size: number = this.brushSize) {
    const canvas = this.canvasRef.nativeElement;

    if (mode === 'pen') {
      size = size * 1.5;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" fill="#FFF" stroke="#000" stroke-width="2"/>
      </svg>`;
      const encoded = encodeURIComponent(svg);
      canvas.style.cursor = `url("data:image/svg+xml,${encoded}") ${size/2} ${size/2}, crosshair`;
    } else if (mode === 'eraser') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size * 2}" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" fill="#FFF" stroke="#000" stroke-width="2"/>
      </svg>`;
      const encoded = encodeURIComponent(svg);
      canvas.style.cursor = `url("data:image/svg+xml,${encoded}") ${size} ${size}, crosshair`;
    } else {
      canvas.style.cursor = this.cursorMap[mode] ?? this.cursorMap['default'];
    }
  }

  setShape(shape: 'rect' | 'circle' | 'line' | 'triangle') {
    this.mode = shape;
    this.setCursor(shape);
    this.showShapes = false;
  }

  setColor() { this.ctx.strokeStyle = this.color; }
  setSize() { 
    this.ctx.lineWidth = this.brushSize;
    this.setCursor(this.mode);
   }
  setPen() { this.mode = 'pen'; this.setCursor('pen'); }
  setEraser() { this.mode = 'eraser'; this.setCursor('eraser'); }
  setText() { this.mode = 'text'; this.setCursor('text'); }
  setRect() { this.mode = 'rect'; }
  setCircle() { this.mode = 'circle'; }
  setLine() { this.mode = 'line'; }
}
