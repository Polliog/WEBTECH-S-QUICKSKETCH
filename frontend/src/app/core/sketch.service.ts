import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';
import {
  GalleryPage,
  SketchDetail,
  StartSketchResponse,
  Word,
} from './models';

@Injectable({ providedIn: 'root' })
export class SketchService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  gallery(page = 1, pageSize = 12): Observable<GalleryPage> {
    const params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);
    return this.http.get<GalleryPage>(`${this.api}/sketches`, { params });
  }

  getOne(id: string): Observable<SketchDetail> {
    return this.http.get<SketchDetail>(`${this.api}/sketches/${id}`);
  }

  words(): Observable<Word[]> {
    return this.http.get<Word[]>(`${this.api}/words`);
  }

  start(wordId: number): Observable<StartSketchResponse> {
    return this.http.post<StartSketchResponse>(`${this.api}/sketches/start`, {
      wordId,
    });
  }

  publish(sketchId: string, image: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(
      `${this.api}/sketches/${sketchId}/publish`,
      { image },
    );
  }
}
