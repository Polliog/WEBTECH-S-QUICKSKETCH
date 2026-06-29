import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SketchService } from '../../core/sketch.service';
import { GameService } from '../../core/game.service';
import { AuthService } from '../../core/auth.service';
import { GameOutcome, Guess, SketchDetail as SketchDetailModel } from '../../core/models';

@Component({
  selector: 'app-sketch-detail',
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './sketch-detail.html',
  styleUrl: './sketch-detail.scss',
})
export class SketchDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly sketches = inject(SketchService);
  private readonly games = inject(GameService);
  private readonly auth = inject(AuthService);

  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly sketch = signal<SketchDetailModel | null>(null);
  readonly notFound = signal(false);

  readonly attempts = signal<Guess[]>([]);
  readonly status = signal<GameOutcome>('NOT_STARTED');
  readonly attemptsLeft = signal(10);
  readonly maxGuesses = signal(10);
  readonly solution = signal<string | null>(null);

  readonly guess = signal('');
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      return;
    }

    this.sketches.getOne(id).subscribe({
      next: (detail) => {
        this.sketch.set(detail);
        if (detail.word) {
          this.solution.set(detail.word);
        }
        if (this.isAuthenticated() && !detail.isAuthor) {
          this.loadGame(id);
        }
      },
      error: () => this.notFound.set(true),
    });
  }

  private loadGame(id: string): void {
    this.games.state(id).subscribe({
      next: (state) => {
        this.attempts.set(state.guesses ?? []);
        this.status.set(state.status);
        this.attemptsLeft.set(state.attemptsLeft);
        this.maxGuesses.set(state.maxGuesses);
        if (state.word) {
          this.solution.set(state.word);
        }
      },
    });
  }

  get canPlay(): boolean {
    const s = this.sketch();
    return (
      !!s &&
      this.isAuthenticated() &&
      !s.isAuthor &&
      (this.status() === 'NOT_STARTED' || this.status() === 'IN_PROGRESS')
    );
  }

  get finished(): boolean {
    return this.status() === 'WON' || this.status() === 'LOST';
  }

  submitGuess(): void {
    const value = this.guess().trim();
    const s = this.sketch();
    if (!value || !s || this.sending()) {
      return;
    }
    this.sending.set(true);
    this.error.set(null);

    this.games.guess(s.id, value).subscribe({
      next: (state) => {
        this.attempts.update((list) => [
          ...list,
          { text: value, correct: state.lastCorrect ?? false },
        ]);
        this.status.set(state.status);
        this.attemptsLeft.set(state.attemptsLeft);
        if (state.word) {
          this.solution.set(state.word);
        }
        this.guess.set('');
        this.sending.set(false);
      },
      error: () => {
        this.error.set('Tentativo non riuscito');
        this.sending.set(false);
      },
    });
  }
}
