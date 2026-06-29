import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { SketchService } from '../../core/sketch.service';
import { AuthService } from '../../core/auth.service';
import { GallerySketch } from '../../core/models';

@Component({
  selector: 'app-gallery',
  imports: [RouterLink, DatePipe],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery implements OnInit {
  private readonly sketches = inject(SketchService);
  private readonly auth = inject(AuthService);

  readonly items = signal<GallerySketch[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 12;
  readonly loading = signal(false);

  readonly isAuthenticated = this.auth.isAuthenticated;

  ngOnInit(): void {
    this.load(1);
  }

  load(page: number): void {
    this.loading.set(true);
    this.sketches.gallery(page, this.pageSize).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.page.set(result.page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  prev(): void {
    if (this.page() > 1) {
      this.load(this.page() - 1);
    }
  }

  next(): void {
    if (this.page() < this.totalPages) {
      this.load(this.page() + 1);
    }
  }
}
