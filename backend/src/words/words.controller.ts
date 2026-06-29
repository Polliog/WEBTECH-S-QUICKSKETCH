import { Controller, Get, UseGuards } from '@nestjs/common';
import { WordsService } from './words.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('words')
export class WordsController {
  constructor(private readonly words: WordsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.words.list();
  }
}
