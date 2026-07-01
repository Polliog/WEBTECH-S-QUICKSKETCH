import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MIN_FINISHED_GAMES = 1;
const TOP_LIMIT = 20;

interface DrawerRow {
  id: string;
  username: string;
  finished: bigint;
  won: bigint;
}

interface PlayerRow {
  id: string;
  username: string;
  wins: bigint;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Classifica dei migliori disegnatori. Per ogni autore conta, sui suoi sketch
   * pubblicati, le partite concluse dagli altri (WON+LOST) e quelle vinte (WON),
   * e ordina per percentuale di successo (vinte/concluse). Sono inclusi solo gli
   * autori con almeno una partita conclusa; a parita' di percentuale vince chi ha
   * piu' sketch indovinati, poi l'ordine alfabetico.
   * @returns i primi 20 disegnatori con indovinati, partite concluse e % successo.
   */
  async drawers() {
    const rows = await this.prisma.$queryRaw<DrawerRow[]>(Prisma.sql`
      SELECT u.id,
             u.username,
             COUNT(g.*) FILTER (WHERE g.status IN ('WON', 'LOST')) AS finished,
             COUNT(g.*) FILTER (WHERE g.status = 'WON') AS won
      FROM "User" u
      JOIN "Sketch" s ON s."authorId" = u.id AND s.status = 'PUBLISHED'
      LEFT JOIN "Game" g ON g."sketchId" = s.id
      GROUP BY u.id, u.username
      HAVING COUNT(g.*) FILTER (WHERE g.status IN ('WON', 'LOST')) >= ${MIN_FINISHED_GAMES}
      ORDER BY (
        COUNT(g.*) FILTER (WHERE g.status = 'WON')::float
        / NULLIF(COUNT(g.*) FILTER (WHERE g.status IN ('WON', 'LOST')), 0)
      ) DESC,
      COUNT(g.*) FILTER (WHERE g.status = 'WON') DESC,
      u.username ASC
      LIMIT ${TOP_LIMIT}
    `);

    return rows.map((row) => {
      const finished = Number(row.finished);
      const won = Number(row.won);
      return {
        userId: row.id,
        username: row.username,
        guessedSketches: won,
        finishedGames: finished,
        successRate: finished > 0 ? Math.round((won / finished) * 100) : 0,
      };
    });
  }

  /**
   * Classifica dei migliori giocatori, per numero di parole indovinate: conta le
   * partite vinte (WON) di ciascun utente, ordinando dal maggior numero di vittorie
   * e, a parita', per ordine alfabetico.
   * @returns i primi 20 giocatori con il numero di parole indovinate.
   */
  async players() {
    const rows = await this.prisma.$queryRaw<PlayerRow[]>(Prisma.sql`
      SELECT u.id, u.username, COUNT(g.*) AS wins
      FROM "User" u
      JOIN "Game" g ON g."playerId" = u.id AND g.status = 'WON'
      GROUP BY u.id, u.username
      ORDER BY wins DESC, u.username ASC
      LIMIT ${TOP_LIMIT}
    `);

    return rows.map((row) => ({
      userId: row.id,
      username: row.username,
      wordsGuessed: Number(row.wins),
    }));
  }
}
