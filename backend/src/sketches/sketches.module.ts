import { Module } from '@nestjs/common';
import { SketchesService } from './sketches.service';
import { SketchesController } from './sketches.controller';

@Module({
  controllers: [SketchesController],
  providers: [SketchesService],
  exports: [SketchesService],
})
export class SketchesModule {}
