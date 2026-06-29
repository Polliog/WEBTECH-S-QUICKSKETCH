import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { GuessDto } from './dto/guess.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get('sketch/:sketchId')
  state(
    @CurrentUser() user: AuthUser,
    @Param('sketchId', ParseUUIDPipe) sketchId: string,
  ) {
    return this.games.getState(user.id, sketchId);
  }

  @Post('sketch/:sketchId/guess')
  guess(
    @CurrentUser() user: AuthUser,
    @Param('sketchId', ParseUUIDPipe) sketchId: string,
    @Body() dto: GuessDto,
  ) {
    return this.games.guess(user.id, sketchId, dto.guess);
  }
}
