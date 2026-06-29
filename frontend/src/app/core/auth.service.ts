import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_URL } from './api.config';
import { AuthUser, Session } from './models';

const TOKEN_KEY = 'quicksketch.token';
const USER_KEY = 'quicksketch.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  private readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly currentUser = signal<AuthUser | null>(this.readStoredUser());

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.token() !== null);

  register(username: string, password: string): Observable<Session> {
    return this.http
      .post<Session>(`${this.api}/auth/register`, { username, password })
      .pipe(tap((session) => this.store(session)));
  }

  login(username: string, password: string): Observable<Session> {
    return this.http
      .post<Session>(`${this.api}/auth/login`, { username, password })
      .pipe(tap((session) => this.store(session)));
  }

  logout(): void {
    this.token.set(null);
    this.currentUser.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getToken(): string | null {
    return this.token();
  }

  private store(session: Session): void {
    this.token.set(session.accessToken);
    this.currentUser.set(session.user);
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  }

  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
