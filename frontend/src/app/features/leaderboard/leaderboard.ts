import { Component, OnInit, inject, signal } from '@angular/core';
import { LeaderboardService } from '../../core/leaderboard.service';
import { DrawerRow, PlayerRow } from '../../core/models';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class Leaderboard implements OnInit {
  private readonly service = inject(LeaderboardService);

  readonly tab = signal<'drawers' | 'players'>('drawers');
  readonly drawers = signal<DrawerRow[]>([]);
  readonly players = signal<PlayerRow[]>([]);

  ngOnInit(): void {
    this.service.drawers().subscribe((rows) => this.drawers.set(rows));
    this.service.players().subscribe((rows) => this.players.set(rows));
  }
}
