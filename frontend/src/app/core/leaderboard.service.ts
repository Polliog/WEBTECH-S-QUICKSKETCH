import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';
import { DrawerRow, PlayerRow } from './models';

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  drawers(): Observable<DrawerRow[]> {
    return this.http.get<DrawerRow[]>(`${this.api}/leaderboard/drawers`);
  }

  players(): Observable<PlayerRow[]> {
    return this.http.get<PlayerRow[]>(`${this.api}/leaderboard/players`);
  }
}
