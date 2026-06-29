import { Controller, Get } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get('drawers')
  drawers() {
    return this.leaderboard.drawers();
  }

  @Get('players')
  players() {
    return this.leaderboard.players();
  }
}
