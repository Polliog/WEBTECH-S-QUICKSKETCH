import { Component, OnInit, inject, signal } from '@angular/core';
import { StatsService } from '../../core/stats.service';
import { AuthService } from '../../core/auth.service';
import { PersonalStats } from '../../core/models';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
})
export class Stats implements OnInit {
  private readonly service = inject(StatsService);
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly stats = signal<PersonalStats | null>(null);

  ngOnInit(): void {
    this.service.me().subscribe((data) => this.stats.set(data));
  }
}
