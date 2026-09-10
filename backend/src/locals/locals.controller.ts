import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScope } from '../auth/tenant-scope';
import { Local } from './local.entity';

@Controller('locals')
@ApiTags('locals')
@ApiBearerAuth('bearer')
export class LocalsController {
  constructor(private readonly tenant: TenantScope) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get a local by id (caller’s local only; other locals 404)',
  })
  getOne(@Param('id') id: string) {
    return this.tenant.getByIdOrNotFound(Local, id);
  }
}
