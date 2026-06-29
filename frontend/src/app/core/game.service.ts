import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';
import { GameState } from './models';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  state(sketchId: string): Observable<GameState> {
    return this.http.get<GameState>(`${this.api}/games/sketch/${sketchId}`);
  }

  guess(sketchId: string, guess: string): Observable<GameState> {
    return this.http.post<GameState>(
      `${this.api}/games/sketch/${sketchId}/guess`,
      { guess },
    );
  }
}
