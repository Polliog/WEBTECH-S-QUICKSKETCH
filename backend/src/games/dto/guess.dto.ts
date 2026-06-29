import { IsString, MaxLength, MinLength } from 'class-validator';

export class GuessDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  guess: string;
}
