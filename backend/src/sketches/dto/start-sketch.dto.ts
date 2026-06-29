import { IsInt, IsPositive } from 'class-validator';

export class StartSketchDto {
  @IsInt()
  @IsPositive()
  wordId: number;
}
