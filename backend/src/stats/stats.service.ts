import { Injectable } from '@nestjs/common';
import { GameStatus, SketchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string) {
    const [
      drawingsProduced,
      wordsGuessed,
      wordsMissed,
      gamesInProgress,
      attemptsUsed,
      othersFinishedOnMySketches,
      othersWonOnMySketches,
    ] = await this.prisma.$transaction([
      this.prisma.sketch.count({
        where: { authorId: userId, status: SketchStatus.PUBLISHED },
      }),
      this.prisma.game.count({
        where: { playerId: userId, status: GameStatus.WON },
      }),
      this.prisma.game.count({
        where: { playerId: userId, status: GameStatus.LOST },
      }),
      this.prisma.game.count({
        where: { playerId: userId, status: GameStatus.IN_PROGRESS },
      }),
      this.prisma.guess.count({
        where: { game: { playerId: userId } },
      }),
      this.prisma.game.count({
        where: {
          sketch: { authorId: userId },
          status: { in: [GameStatus.WON, GameStatus.LOST] },
        },
      }),
      this.prisma.game.count({
        where: { sketch: { authorId: userId }, status: GameStatus.WON },
      }),
    ]);

    const drawerSuccessRate =
      othersFinishedOnMySketches > 0
        ? Math.round((othersWonOnMySketches / othersFinishedOnMySketches) * 100)
        : null;

    return {
      drawingsProduced,
      wordsGuessed,
      wordsMissed,
      gamesInProgress,
      attemptsUsed,
      drawer: {
        finishedGamesOnMySketches: othersFinishedOnMySketches,
        guessedSketches: othersWonOnMySketches,
        successRate: drawerSuccessRate,
      },
    };
  }
}
