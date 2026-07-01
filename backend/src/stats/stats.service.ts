import { Injectable } from '@nestjs/common';
import { GameStatus, SketchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Statistiche personali dell'utente, calcolate in un'unica transazione:
   * disegni pubblicati, parole indovinate (partite vinte) e non indovinate
   * (perse), partite in corso, tentativi totali usati e, come disegnatore, quante
   * partite gli altri hanno concluso/vinto sui suoi sketch con la relativa % di
   * successo.
   * @param userId id dell'utente.
   * @returns riepilogo numerico delle statistiche personali.
   */
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

    // Percentuale di successo come disegnatore: null se nessuno ha ancora
    // concluso una partita sui suoi sketch (evita la divisione per zero).
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
