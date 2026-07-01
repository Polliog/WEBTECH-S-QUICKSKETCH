import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GameStatus, SketchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Normalizza un testo per confrontare tentativo e parola in modo tollerante:
 * rimuove gli accenti, porta in minuscolo, taglia gli spazi ai bordi e riduce
 * gli spazi multipli. Cosi "Città " e "citta" risultano equivalenti.
 * @param value testo da normalizzare.
 * @returns testo normalizzato per il confronto.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get maxGuesses(): number {
    return this.config.get<number>('game.maxGuesses') ?? 10;
  }

  /**
   * Stato corrente della partita dell'utente su uno sketch: tentativi usati e
   * rimasti, esito e cronologia. La parola viene inclusa solo a partita conclusa.
   * @param userId id del giocatore.
   * @param sketchId id dello sketch giocato.
   * @returns stato della partita (o stato "non iniziata" se non ha ancora giocato).
   */
  async getState(userId: string, sketchId: string) {
    const sketch = await this.loadPlayableSketch(userId, sketchId);

    const game = await this.prisma.game.findUnique({
      where: { sketchId_playerId: { sketchId, playerId: userId } },
      include: {
        guesses: {
          orderBy: { createdAt: 'asc' },
          select: { text: true, correct: true },
        },
      },
    });

    if (!game) {
      return this.emptyState(sketchId);
    }

    const finished =
      game.status === GameStatus.WON || game.status === GameStatus.LOST;

    return {
      sketchId,
      status: game.status,
      attemptsUsed: game.guesses.length,
      attemptsLeft: this.maxGuesses - game.guesses.length,
      maxGuesses: this.maxGuesses,
      guesses: game.guesses,
      word: finished ? sketch.word.text : null,
    };
  }

  /**
   * Registra un tentativo di indovinare e aggiorna lo stato della partita.
   * La partita si crea al primo tentativo; si vince appena il testo coincide con
   * la parola, si perde al raggiungimento del numero massimo di tentativi (10);
   * una volta conclusa non si puo' piu' giocare quello sketch.
   * @param userId id del giocatore.
   * @param sketchId id dello sketch giocato.
   * @param attempt testo del tentativo.
   * @returns esito del tentativo, stato partita, tentativi rimasti e (a fine
   *          partita) la parola corretta.
   */
  async guess(userId: string, sketchId: string, attempt: string) {
    const sketch = await this.loadPlayableSketch(userId, sketchId);

    // La partita nasce al primo tentativo: se non esiste, la creiamo ora.
    let game = await this.prisma.game.findUnique({
      where: { sketchId_playerId: { sketchId, playerId: userId } },
    });

    if (!game) {
      game = await this.prisma.game.create({
        data: { sketchId, playerId: userId, status: GameStatus.IN_PROGRESS },
      });
    }

    // Partita gia' vinta o persa: niente altri tentativi.
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('This sketch is already closed for you');
    }

    // Confronto tollerante (accenti, maiuscole, spazi) tra tentativo e parola.
    const correct = normalize(attempt) === normalize(sketch.word.text);

    // Salvataggio del tentativo e calcolo del nuovo stato in un'unica
    // transazione, cosi il conteggio dei tentativi resta coerente.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.guess.create({
        data: { gameId: game!.id, text: attempt, correct },
      });

      const attemptsUsed = await tx.guess.count({
        where: { gameId: game!.id },
      });

      // Vittoria se ha indovinato; sconfitta se ha esaurito i 10 tentativi.
      let status: GameStatus = GameStatus.IN_PROGRESS;
      if (correct) {
        status = GameStatus.WON;
      } else if (attemptsUsed >= this.maxGuesses) {
        status = GameStatus.LOST;
      }

      if (status !== GameStatus.IN_PROGRESS) {
        await tx.game.update({
          where: { id: game!.id },
          data: { status, finishedAt: new Date() },
        });
      }

      return { attemptsUsed, status };
    });

    const finished = updated.status !== GameStatus.IN_PROGRESS;

    return {
      sketchId,
      status: updated.status,
      lastCorrect: correct,
      attemptsUsed: updated.attemptsUsed,
      attemptsLeft: this.maxGuesses - updated.attemptsUsed,
      maxGuesses: this.maxGuesses,
      word: finished ? sketch.word.text : null,
    };
  }

  /**
   * Carica uno sketch verificando che sia giocabile dall'utente: deve esistere,
   * essere pubblicato e non essere il proprio (non si indovina il proprio sketch).
   * @param userId id del giocatore.
   * @param sketchId id dello sketch.
   * @returns lo sketch con la parola associata (per il confronto lato server).
   */
  private async loadPlayableSketch(userId: string, sketchId: string) {
    const sketch = await this.prisma.sketch.findUnique({
      where: { id: sketchId },
      select: {
        id: true,
        authorId: true,
        status: true,
        word: { select: { text: true } },
      },
    });

    if (!sketch || sketch.status !== SketchStatus.PUBLISHED) {
      throw new NotFoundException('Sketch not found');
    }
    if (sketch.authorId === userId) {
      throw new ForbiddenException('You cannot guess your own sketch');
    }
    return sketch;
  }

  /**
   * Stato restituito quando l'utente non ha ancora tentato lo sketch:
   * tutti i tentativi disponibili e nessuna cronologia.
   * @param sketchId id dello sketch.
   * @returns stato "non iniziata".
   */
  private emptyState(sketchId: string) {
    return {
      sketchId,
      status: 'NOT_STARTED' as const,
      attemptsUsed: 0,
      attemptsLeft: this.maxGuesses,
      maxGuesses: this.maxGuesses,
      guesses: [] as { text: string; correct: boolean }[],
      word: null,
    };
  }
}
