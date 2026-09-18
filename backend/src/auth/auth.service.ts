import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Member } from '../members/entities/member.entity';
import { LoginDto } from './dto/login.dto';
import { User } from './entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Member)
    private readonly members: Repository<Member>,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException();
    }
    const member = await this.members.findOne({ where: { userId: user.id } });
    if (!member || member.status !== 'active') {
      throw new UnauthorizedException();
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      memberId: member.id,
      localId: member.localId,
      role: member.role,
    });

    return {
      accessToken,
      member: {
        id: member.id,
        localId: member.localId,
        role: member.role,
        fullName: member.fullName,
      },
    };
  }
}
