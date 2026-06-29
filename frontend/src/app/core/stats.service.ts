import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';
import { PersonalStats } from './models';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  me(): Observable<PersonalStats> {
    return this.http.get<PersonalStats>(`${this.api}/stats/me`);
  }
}
