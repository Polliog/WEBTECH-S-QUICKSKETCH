import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GameStatus, Sketch, SketchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SketchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async start(userId: string, wordId: number) {
    const word = await this.prisma.word.findUnique({ where: { id: wordId } });
    if (!word) {
      throw new NotFoundException('Word not found');
    }

    const sketch = await this.prisma.sketch.create({
      data: {
        authorId: userId,
        wordId: word.id,
        status: SketchStatus.DRAFT,
      },
    });

    return {
      sketchId: sketch.id,
      word: word.text,
      timeLimitSeconds: this.config.get<number>('game.drawTimeLimitSeconds'),
      startedAt: sketch.startedAt,
    };
  }

  async publish(userId: string, sketchId: string, image: string) {
    const sketch = await this.prisma.sketch.findUnique({
      where: { id: sketchId },
    });
    if (!sketch) {
      throw new NotFoundException('Sketch not found');
    }
    if (sketch.authorId !== userId) {
      throw new ForbiddenException('You are not the author of this sketch');
    }
    if (sketch.status !== SketchStatus.DRAFT) {
      throw new BadRequestException('Sketch already published');
    }

    const limit = this.config.get<number>('game.drawTimeLimitSeconds') ?? 60;
    const grace = this.config.get<number>('game.drawTimeGraceSeconds') ?? 5;
    const elapsedSeconds = (Date.now() - sketch.startedAt.getTime()) / 1000;
    if (elapsedSeconds > limit + grace) {
      throw new BadRequestException('Drawing time expired');
    }

    const maxBytes = this.config.get<number>('game.maxImageBytes') ?? 1500000;
    const base64 = image.split(',')[1] ?? '';
    const sizeBytes = Buffer.byteLength(base64, 'base64');
    if (sizeBytes > maxBytes) {
      throw new PayloadTooLargeException('Image is too large');
    }

    const published = await this.prisma.sketch.update({
      where: { id: sketch.id },
      data: {
        image,
        status: SketchStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    return { id: published.id, publishedAt: published.publishedAt };
  }

  async gallery(currentUserId: string | null, page: number, pageSize: number) {
    const take = Math.min(Math.max(pageSize, 1), 50);
    const skip = Math.max(page - 1, 0) * take;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sketch.findMany({
        where: { status: SketchStatus.PUBLISHED },
        orderBy: { publishedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          image: true,
          publishedAt: true,
          author: { select: { id: true, username: true } },
        },
      }),
      this.prisma.sketch.count({ where: { status: SketchStatus.PUBLISHED } }),
    ]);

    const myGames = await this.loadMyGames(
      currentUserId,
      items.map((s) => s.id),
    );

    return {
      items: items.map((s) => ({
        id: s.id,
        image: s.image,
        publishedAt: s.publishedAt,
        author: s.author,
        isAuthor: currentUserId === s.author.id,
        myGameStatus: myGames.get(s.id) ?? null,
      })),
      total,
      page,
      pageSize: take,
    };
  }

  async getOne(currentUserId: string | null, sketchId: string) {
    const sketch = await this.prisma.sketch.findUnique({
      where: { id: sketchId },
      select: {
        id: true,
        image: true,
        status: true,
        publishedAt: true,
        author: { select: { id: true, username: true } },
        word: { select: { text: true } },
      },
    });

    if (!sketch || sketch.status !== SketchStatus.PUBLISHED) {
      throw new NotFoundException('Sketch not found');
    }

    const isAuthor = currentUserId === sketch.author.id;
    const myGame = currentUserId
      ? await this.prisma.game.findUnique({
          where: {
            sketchId_playerId: { sketchId, playerId: currentUserId },
          },
          select: { status: true },
        })
      : null;

    const finished =
      myGame?.status === GameStatus.WON || myGame?.status === GameStatus.LOST;
    const reveal = isAuthor || finished;

    return {
      id: sketch.id,
      image: sketch.image,
      publishedAt: sketch.publishedAt,
      author: sketch.author,
      isAuthor,
      myGameStatus: myGame?.status ?? null,
      word: reveal ? sketch.word.text : null,
    };
  }

  private async loadMyGames(currentUserId: string | null, sketchIds: string[]) {
    const map = new Map<string, GameStatus>();
    if (!currentUserId || sketchIds.length === 0) {
      return map;
    }
    const games = await this.prisma.game.findMany({
      where: { playerId: currentUserId, sketchId: { in: sketchIds } },
      select: { sketchId: true, status: true },
    });
    for (const game of games) {
      map.set(game.sketchId, game.status);
    }
    return map;
  }

  async assertPublished(sketchId: string): Promise<Sketch> {
    const sketch = await this.prisma.sketch.findUnique({
      where: { id: sketchId },
    });
    if (!sketch || sketch.status !== SketchStatus.PUBLISHED) {
      throw new NotFoundException('Sketch not found');
    }
    return sketch;
  }
}
