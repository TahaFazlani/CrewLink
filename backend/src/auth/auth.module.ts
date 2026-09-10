import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../members/member.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { LeadershipController } from './leadership.controller';
import { TenantScope } from './tenant-scope';
import { User } from './user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Member]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-only-change-me'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as `${number}h`,
        },
      }),
    }),
  ],
  controllers: [AuthController, LeadershipController],
  providers: [AuthService, JwtStrategy, TenantScope],
  exports: [JwtModule, PassportModule, TypeOrmModule, TenantScope],
})
export class AuthModule {}
