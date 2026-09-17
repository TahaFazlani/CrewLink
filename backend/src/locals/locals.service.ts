import { Injectable } from '@nestjs/common';
import { TenantScope } from '../tenant/tenant-scope';
import { Local } from './entities/local.entity';

@Injectable()
export class LocalsService {
  constructor(private readonly tenant: TenantScope) {}

  async get(id: string) {
    const local = await this.tenant.getByIdOrNotFound(Local, id);
    return { id: local.id, name: local.name };
  }
}
