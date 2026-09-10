import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Member } from '../members/member.entity';
import type { AuthUser } from './auth-user';

type JwtPayload = {
  sub: string;
  memberId: string;
  localId: string;
  role: string;
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
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-only-change-me'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const member = await this.members.findOne({
      where: { userId: payload.sub },
    });
    if (!member) {
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
