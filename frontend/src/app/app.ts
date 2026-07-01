import { Component, inject, signal } from '@angular/core';
import {
  Event,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { Navbar } from './shared/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);

  /** Barra di avanzamento tra una pagina e l'altra (tratto d'inchiostro). */
  readonly progress = signal(0);
  readonly loading = signal(false);

  private trickle: ReturnType<typeof setInterval> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.router.events.subscribe((e: Event) => {
      if (e instanceof NavigationStart) {
        this.begin();
      } else if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError
      ) {
        this.finish();
      }
    });
  }

  private begin(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.trickle) {
      clearInterval(this.trickle);
    }
    this.loading.set(true);
    this.progress.set(14);
    // Avanza da solo verso il 90%, rallentando: da la sensazione di progresso reale.
    this.trickle = setInterval(() => {
      const p = this.progress();
      if (p < 90) {
        this.progress.set(Math.min(90, p + Math.max(1.5, (92 - p) / 9)));
      }
    }, 240);
  }

  private finish(): void {
    if (this.trickle) {
      clearInterval(this.trickle);
      this.trickle = null;
    }
    this.progress.set(100);
    this.hideTimer = setTimeout(() => {
      this.loading.set(false);
      this.progress.set(0);
    }, 400);
  }
}
