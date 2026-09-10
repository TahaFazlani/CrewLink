import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
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
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
