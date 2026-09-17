import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Local } from './entities/local.entity';
import { LocalsController } from './locals.controller';
import { LocalsService } from './locals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Local])],
  controllers: [LocalsController],
  providers: [LocalsService],
  exports: [TypeOrmModule],
})
export class LocalsModule {}
