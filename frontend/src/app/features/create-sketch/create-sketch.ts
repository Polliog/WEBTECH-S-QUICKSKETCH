import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { SketchService } from '../../core/sketch.service';
import { Word } from '../../core/models';

type Phase = 'choosing' | 'drawing' | 'publishing';

const COLORS = ['#23262e', '#cb3f27', '#294c87', '#3b7a50', '#d79a2b', '#ffffff'];

@Component({
  selector: 'app-create-sketch',
  templateUrl: './create-sketch.html',
  styleUrl: './create-sketch.scss',
})
export class CreateSketch implements OnInit, OnDestroy {
  private readonly sketches = inject(SketchService);
  private readonly router = inject(Router);

  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private ctx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private canvasReady = false;

  readonly colors = COLORS;
  readonly phase = signal<Phase>('choosing');
  readonly words = signal<Word[]>([]);
  readonly selectedWordId = signal<number | null>(null);
  readonly error = signal<string | null>(null);

  readonly currentWord = signal<string>('');
  readonly remaining = signal<number>(0);
  readonly timeLimit = signal<number>(60);

  readonly color = signal<string>(COLORS[0]);
  readonly brush = signal<number>(6);

  private sketchId: string | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const ref = this.canvasRef();
      if (ref && !this.canvasReady) {
        this.initCanvas(ref.nativeElement);
      }
    });
  }

  ngOnInit(): void {
    this.sketches.words().subscribe({
      next: (words) => this.words.set(words),
      error: () => this.error.set('Impossibile caricare le parole'),
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  start(): void {
    const wordId = this.selectedWordId();
    if (!wordId) {
      return;
    }
    this.error.set(null);
    this.sketches.start(wordId).subscribe({
      next: (res) => {
        this.sketchId = res.sketchId;
        this.currentWord.set(res.word);
        this.timeLimit.set(res.timeLimitSeconds);
        this.remaining.set(res.timeLimitSeconds);
        this.canvasReady = false;
        this.phase.set('drawing');
        this.startTimer();
      },
      error: () => this.error.set('Impossibile avviare lo sketch'),
    });
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerId = setInterval(() => {
      const left = this.remaining() - 1;
      if (left <= 0) {
        this.remaining.set(0);
        this.stopTimer();
        this.publish();
      } else {
        this.remaining.set(left);
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private initCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.ctx = ctx;
    this.canvasReady = true;
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef()!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.ctx) {
      return;
    }
    this.drawing = true;
    const { x, y } = this.point(event);
    this.ctx.strokeStyle = this.color();
    this.ctx.fillStyle = this.color();
    this.ctx.lineWidth = this.brush();
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.brush() / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing || !this.ctx) {
      return;
    }
    const { x, y } = this.point(event);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  onPointerUp(): void {
    this.drawing = false;
  }

  clear(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.ctx) {
      return;
    }
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  publish(): void {
    if (!this.sketchId || this.phase() === 'publishing') {
      return;
    }
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }
    this.stopTimer();
    this.phase.set('publishing');
    const image = canvas.toDataURL('image/png');

    this.sketches.publish(this.sketchId, image).subscribe({
      next: (res) => this.router.navigate(['/sketch', res.id]),
      error: () => {
        this.error.set('Pubblicazione non riuscita');
        this.phase.set('drawing');
      },
    });
  }
}
