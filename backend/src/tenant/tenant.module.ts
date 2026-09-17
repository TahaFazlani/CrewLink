import { Global, Module } from '@nestjs/common';
import { TenantScope } from './tenant-scope';

@Global()
@Module({
  providers: [TenantScope],
  exports: [TenantScope],
})
export class TenantModule {}
