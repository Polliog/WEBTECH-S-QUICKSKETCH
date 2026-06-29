import { IsString, Matches } from 'class-validator';

export class PublishSketchDto {
  @IsString()
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, {
    message: 'image must be a base64 encoded PNG data URL',
  })
  image: string;
}
