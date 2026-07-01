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

  /**
   * Avvia un nuovo sketch: crea una bozza (DRAFT) e fa partire il conto alla
   * rovescia lato server (`startedAt`). La parola scelta viene restituita solo
   * qui, all'autore, perche' e' lui a doverla disegnare.
   * @param userId id dell'utente autore.
   * @param wordId id della parola scelta dall'insieme predefinito.
   * @returns id della bozza, parola da disegnare, tempo limite e istante d'avvio.
   */
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

  /**
   * Pubblica una bozza rendendola visibile nella galleria. Verifica che chi
   * pubblica sia l'autore, che lo sketch non sia gia' pubblicato, che il tempo
   * non sia scaduto e che l'immagine non superi la dimensione massima.
   * @param userId id dell'utente che pubblica (deve essere l'autore).
   * @param sketchId id della bozza da pubblicare.
   * @param image disegno come data URL PNG (`data:image/png;base64,...`).
   * @returns id dello sketch pubblicato e istante di pubblicazione.
   */
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

    // Il tempo e' validato QUI, lato server, non nel client: `startedAt` e'
    // fissato all'avvio, cosi manomettere il timer nel front-end e' inutile.
    // `grace` e' una piccola tolleranza per la latenza di rete.
    const limit = this.config.get<number>('game.drawTimeLimitSeconds') ?? 60;
    const grace = this.config.get<number>('game.drawTimeGraceSeconds') ?? 5;
    const elapsedSeconds = (Date.now() - sketch.startedAt.getTime()) / 1000;
    if (elapsedSeconds > limit + grace) {
      throw new BadRequestException('Drawing time expired');
    }

    // Misura i byte reali del PNG scartando il prefisso `data:image/png;base64,`.
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

  /**
   * Galleria pubblica degli sketch pubblicati, paginata e dal piu' recente.
   * Accessibile anche agli utenti anonimi; la parola non viene mai inclusa.
   * Per gli utenti autenticati aggiunge, per ogni sketch, lo stato della propria
   * partita (per mostrare i badge "Tuo / Indovinato / Perso / In corso").
   * @param currentUserId id dell'utente loggato, oppure `null` se anonimo.
   * @param page numero di pagina (1-based).
   * @param pageSize elementi per pagina (limitato a 1..50).
   * @returns elenco sketch, totale e informazioni di paginazione.
   */
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

  /**
   * Dettaglio di un singolo sketch pubblicato. La parola (soluzione) e' inclusa
   * solo se chi guarda e' l'autore oppure ha gia' concluso la partita (vinta o
   * persa): durante il gioco non deve mai raggiungere il client.
   * @param currentUserId id dell'utente loggato, oppure `null` se anonimo.
   * @param sketchId id dello sketch.
   * @returns dati dello sketch; `word` valorizzato solo se puo' essere svelato.
   */
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
    // La parola si svela solo all'autore o a chi ha gia' vinto/perso la partita.
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

  /**
   * Carica lo stato delle partite dell'utente su un gruppo di sketch, in una
   * sola query, per evitare una richiesta per ogni tessera della galleria.
   * @param currentUserId id dell'utente, oppure `null` se anonimo.
   * @param sketchIds id degli sketch visibili nella pagina corrente.
   * @returns mappa `sketchId -> stato partita` (vuota se anonimo).
   */
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

  /**
   * Verifica che uno sketch esista e sia pubblicato, altrimenti solleva 404.
   * @param sketchId id dello sketch da controllare.
   * @returns lo sketch pubblicato.
   */
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
