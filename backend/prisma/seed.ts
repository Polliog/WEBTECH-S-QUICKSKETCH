import { PrismaClient, GameStatus, SketchStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { deflateSync } from 'zlib';

const prisma = new PrismaClient();

const WORDS = [
  'casa', 'cane', 'gatto', 'sole', 'luna', 'albero', 'mare', 'montagna',
  'fiore', 'stella', 'pesce', 'uccello', 'macchina', 'treno', 'aereo',
  'libro', 'penna', 'computer', 'telefono', 'chiave', 'porta', 'finestra',
  'sedia', 'tavolo', 'letto', 'orologio', 'cappello', 'scarpa', 'ombrello',
  'bicicletta', 'chitarra', 'pianoforte', 'palla', 'fragola', 'banana',
  'mela', 'pizza', 'gelato', 'torta', 'barca',
];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function solidPng(size: number, rgb: [number, number, number]): string {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const rowLength = size * 3 + 1;
  const raw = Buffer.alloc(rowLength * size);
  for (let y = 0; y < size; y++) {
    const offset = y * rowLength;
    raw[offset] = 0;
    for (let x = 0; x < size; x++) {
      const p = offset + 1 + x * 3;
      raw[p] = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
    }
  }

  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  return `data:image/png;base64,${png.toString('base64')}`;
}

const PALETTE: [number, number, number][] = [
  [239, 71, 111],
  [255, 209, 102],
  [6, 214, 160],
  [17, 138, 178],
  [118, 120, 237],
  [255, 145, 77],
  [38, 166, 154],
  [171, 71, 188],
];

async function main() {
  await prisma.guess.deleteMany();
  await prisma.game.deleteMany();
  await prisma.sketch.deleteMany();
  await prisma.word.deleteMany();
  await prisma.user.deleteMany();

  await prisma.word.createMany({
    data: WORDS.map((text) => ({ text })),
  });
  const words = await prisma.word.findMany();
  const wordByText = new Map(words.map((w) => [w.text, w]));

  const passwordHash = await argon2.hash('password123');
  const usernames = ['giuseppe', 'mario', 'antonio', 'alessandro'];
  const users: Record<string, { id: string }> = {};
  for (const username of usernames) {
    users[username] = await prisma.user.create({
      data: { username, passwordHash },
      select: { id: true },
    });
  }

  const plan: { author: string; word: string }[] = [
    { author: 'giuseppe', word: 'gatto' },
    { author: 'giuseppe', word: 'sole' },
    { author: 'giuseppe', word: 'albero' },
    { author: 'giuseppe', word: 'pizza' },
    { author: 'mario', word: 'cane' },
    { author: 'mario', word: 'mare' },
    { author: 'mario', word: 'macchina' },
    { author: 'antonio', word: 'fiore' },
    { author: 'antonio', word: 'luna' },
  ];

  const sketches: { id: string; word: string; author: string }[] = [];
  let day = 0;
  for (const [index, item] of plan.entries()) {
    const word = wordByText.get(item.word)!;
    const publishedAt = new Date(Date.now() - (plan.length - index) * 3600_000);
    const sketch = await prisma.sketch.create({
      data: {
        authorId: users[item.author].id,
        wordId: word.id,
        status: SketchStatus.PUBLISHED,
        image: solidPng(48, PALETTE[index % PALETTE.length]),
        startedAt: new Date(publishedAt.getTime() - 60_000),
        publishedAt,
      },
      select: { id: true },
    });
    sketches.push({ id: sketch.id, word: item.word, author: item.author });
    day++;
  }

  async function play(
    player: string,
    sketch: { id: string; word: string },
    outcome: 'WON' | 'LOST',
    wrongAttempts: number,
  ) {
    const game = await prisma.game.create({
      data: {
        sketchId: sketch.id,
        playerId: users[player].id,
        status: outcome === 'WON' ? GameStatus.WON : GameStatus.LOST,
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    const wrong = outcome === 'LOST' ? 10 : Math.min(wrongAttempts, 9);
    for (let i = 0; i < wrong; i++) {
      await prisma.guess.create({
        data: { gameId: game.id, text: `tentativo${i + 1}`, correct: false },
      });
    }
    if (outcome === 'WON') {
      await prisma.guess.create({
        data: { gameId: game.id, text: sketch.word, correct: true },
      });
    }
  }

  await play('mario', sketches[0], 'WON', 1);
  await play('antonio', sketches[0], 'WON', 0);
  await play('alessandro', sketches[0], 'LOST', 0);
  await play('mario', sketches[1], 'WON', 2);
  await play('antonio', sketches[1], 'LOST', 0);
  await play('alessandro', sketches[2], 'WON', 0);
  await play('antonio', sketches[3], 'WON', 3);
  await play('giuseppe', sketches[4], 'WON', 1);
  await play('antonio', sketches[4], 'LOST', 0);
  await play('giuseppe', sketches[5], 'WON', 0);
  await play('alessandro', sketches[7], 'WON', 2);
  await play('giuseppe', sketches[8], 'LOST', 0);

  console.log('Seed completed:', {
    users: usernames.length,
    words: WORDS.length,
    sketches: sketches.length,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
