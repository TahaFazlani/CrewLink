import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Local } from './local.entity';
import { LocalsController } from './locals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Local]), AuthModule],
  controllers: [LocalsController],
  exports: [TypeOrmModule],
})
export class LocalsModule {}
