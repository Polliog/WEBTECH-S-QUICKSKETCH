import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Registra un nuovo utente: rifiuta username gia' esistenti, salva solo l'hash
   * Argon2 della password (mai la password in chiaro) e apre subito la sessione.
   * @param dto username e password scelti.
   * @returns token JWT e dati pubblici dell'utente.
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { username: dto.username, passwordHash },
      select: { id: true, username: true },
    });

    return this.buildSession(user.id, user.username);
  }

  /**
   * Autentica un utente verificando la password contro l'hash salvato. Per non
   * rivelare quali username esistano, l'errore e' identico sia se l'utente non
   * esiste sia se la password e' sbagliata.
   * @param dto username e password inseriti.
   * @returns token JWT e dati pubblici dell'utente.
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildSession(user.id, user.username);
  }

  /**
   * Crea la sessione firmando un token JWT con id e username dell'utente.
   * @param id id dell'utente.
   * @param username username dell'utente.
   * @returns token d'accesso e dati pubblici dell'utente.
   */
  private async buildSession(id: string, username: string) {
    const accessToken = await this.jwt.signAsync({ sub: id, username });
    return {
      accessToken,
      user: { id, username },
    };
  }
}
