import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GameStatus, SketchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Confronto tollerante: ignora accenti, maiuscole e spazi extra, così "Città "
// e "citta" risultano equivalenti.
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

  async guess(userId: string, sketchId: string, attempt: string) {
    const sketch = await this.loadPlayableSketch(userId, sketchId);

    let game = await this.prisma.game.findUnique({
      where: { sketchId_playerId: { sketchId, playerId: userId } },
    });

    if (!game) {
      game = await this.prisma.game.create({
        data: { sketchId, playerId: userId, status: GameStatus.IN_PROGRESS },
      });
    }

    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('This sketch is already closed for you');
    }

    const correct = normalize(attempt) === normalize(sketch.word.text);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.guess.create({
        data: { gameId: game!.id, text: attempt, correct },
      });

      const attemptsUsed = await tx.guess.count({
        where: { gameId: game!.id },
      });

      // Vince appena indovina; perde solo dopo aver esaurito i 10 tentativi.
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
