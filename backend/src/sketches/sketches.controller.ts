import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SketchesService } from './sketches.service';
import { StartSketchDto } from './dto/start-sketch.dto';
import { PublishSketchDto } from './dto/publish-sketch.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('sketches')
export class SketchesController {
  constructor(private readonly sketches: SketchesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  gallery(
    @CurrentUser() user: AuthUser | null,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '12',
  ) {
    return this.sketches.gallery(
      user?.id ?? null,
      Number(page) || 1,
      Number(pageSize) || 12,
    );
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getOne(
    @CurrentUser() user: AuthUser | null,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sketches.getOne(user?.id ?? null, id);
  }

  @Post('start')
  @UseGuards(JwtAuthGuard)
  start(@CurrentUser() user: AuthUser, @Body() dto: StartSketchDto) {
    return this.sketches.start(user.id, dto.wordId);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  publish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishSketchDto,
  ) {
    return this.sketches.publish(user.id, id, dto.image);
  }
}
