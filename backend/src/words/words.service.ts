import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WordsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Elenco delle parole dell'insieme predefinito, in ordine alfabetico,
   * mostrato all'autore in fase di scelta.
   * @returns id e testo di tutte le parole disponibili.
   */
  list() {
    return this.prisma.word.findMany({
      select: { id: true, text: true },
      orderBy: { text: 'asc' },
    });
  }
}
