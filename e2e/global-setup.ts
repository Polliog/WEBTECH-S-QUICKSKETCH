import { execSync } from 'child_process';
import * as path from 'path';

export default function globalSetup(): void {
  const backend = path.resolve(__dirname, '../backend');
  const options = { cwd: backend, stdio: 'inherit' as const };

  execSync('npx prisma migrate deploy', options);
  execSync('npm run prisma:seed', options);
}
