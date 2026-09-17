import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Member } from '../../members/entities/member.entity';
import type { AuthUser } from '../models/auth-user';

type JwtPayload = {
  sub: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Member)
    private readonly members: Repository<Member>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const member = await this.members.findOne({
      where: { userId: payload.sub },
    });
    if (!member || member.status !== 'active') {
      throw new UnauthorizedException();
    }
    return {
      userId: member.userId,
      memberId: member.id,
      localId: member.localId,
      role: member.role,
    };
  }
}
