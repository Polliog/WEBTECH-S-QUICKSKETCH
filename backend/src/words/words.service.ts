import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WordsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.word.findMany({
      select: { id: true, text: true },
      orderBy: { text: 'asc' },
    });
  }
}
