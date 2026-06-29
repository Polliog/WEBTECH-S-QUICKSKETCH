export interface AuthUser {
  id: string;
  username: string;
}

export interface Session {
  accessToken: string;
  user: AuthUser;
}

export interface Word {
  id: number;
  text: string;
}

export type GameStatus = 'IN_PROGRESS' | 'WON' | 'LOST';
export type GameOutcome = GameStatus | 'NOT_STARTED';

export interface GallerySketch {
  id: string;
  image: string;
  publishedAt: string;
  author: AuthUser;
  isAuthor: boolean;
  myGameStatus: GameStatus | null;
}

export interface GalleryPage {
  items: GallerySketch[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SketchDetail {
  id: string;
  image: string;
  publishedAt: string;
  author: AuthUser;
  isAuthor: boolean;
  myGameStatus: GameStatus | null;
  word: string | null;
}

export interface Guess {
  text: string;
  correct: boolean;
}

export interface GameState {
  sketchId: string;
  status: GameOutcome;
  attemptsUsed: number;
  attemptsLeft: number;
  maxGuesses: number;
  guesses?: Guess[];
  word: string | null;
  lastCorrect?: boolean;
}

export interface StartSketchResponse {
  sketchId: string;
  word: string;
  timeLimitSeconds: number;
  startedAt: string;
}

export interface DrawerRow {
  userId: string;
  username: string;
  guessedSketches: number;
  finishedGames: number;
  successRate: number;
}

export interface PlayerRow {
  userId: string;
  username: string;
  wordsGuessed: number;
}

export interface PersonalStats {
  drawingsProduced: number;
  wordsGuessed: number;
  wordsMissed: number;
  gamesInProgress: number;
  attemptsUsed: number;
  drawer: {
    finishedGamesOnMySketches: number;
    guessedSketches: number;
    successRate: number | null;
  };
}
