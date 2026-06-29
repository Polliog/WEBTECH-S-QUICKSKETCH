export interface AppConfig {
  port: number;
  corsOrigin: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  game: {
    drawTimeLimitSeconds: number;
    drawTimeGraceSeconds: number;
    maxGuesses: number;
    maxImageBytes: number;
  };
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function configuration(): AppConfig {
  return {
    port: int(process.env.PORT, 3000),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    jwt: {
      secret: process.env.JWT_SECRET ?? '',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    },
    game: {
      drawTimeLimitSeconds: int(process.env.DRAW_TIME_LIMIT_SECONDS, 60),
      drawTimeGraceSeconds: int(process.env.DRAW_TIME_GRACE_SECONDS, 5),
      maxGuesses: int(process.env.MAX_GUESSES, 10),
      maxImageBytes: int(process.env.MAX_IMAGE_BYTES, 1500000),
    },
  };
}
