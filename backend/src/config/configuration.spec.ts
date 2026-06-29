import { configuration } from './configuration';

describe('configuration', () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
  });

  it('uses sensible defaults when env vars are missing', () => {
    process.env = {} as NodeJS.ProcessEnv;
    const config = configuration();

    expect(config.port).toBe(3000);
    expect(config.game.maxGuesses).toBe(10);
    expect(config.game.drawTimeLimitSeconds).toBe(60);
    expect(config.corsOrigin).toBe('http://localhost:4200');
  });

  it('parses numeric values from the environment', () => {
    process.env = {
      PORT: '4000',
      MAX_GUESSES: '5',
      DRAW_TIME_LIMIT_SECONDS: '30',
    } as NodeJS.ProcessEnv;
    const config = configuration();

    expect(config.port).toBe(4000);
    expect(config.game.maxGuesses).toBe(5);
    expect(config.game.drawTimeLimitSeconds).toBe(30);
  });
});
