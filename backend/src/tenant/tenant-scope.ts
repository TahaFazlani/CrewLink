import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Request } from 'express';
import {
  DataSource,
  EntityTarget,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import type { AuthUser } from '../auth/models/auth-user';

type AuthedRequest = Request & { user?: AuthUser };

@Injectable({ scope: Scope.REQUEST })
export class TenantScope {
  private readonly logger = new Logger('Authz');

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: AuthedRequest,
  ) {}

  forEntity<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const localId = this.requireLocalId();
    const meta = this.dataSource.getMetadata(entity);
    const qb = this.dataSource.getRepository(entity).createQueryBuilder(alias);

    if (meta.tableName === 'announcement_recipients') {
      qb.innerJoinAndSelect(`${alias}.announcement`, `${alias}_announcement`);
      qb.andWhere(`${alias}_announcement.localId = :tenantLocalId`, {
        tenantLocalId: localId,
      });
      return qb;
    }

    if (meta.tableName === 'locals') {
      qb.andWhere(`${alias}.id = :tenantLocalId`, { tenantLocalId: localId });
      return qb;
    }

    const hasLocalId = meta.columns.some(
      (column) =>
        column.propertyName === 'localId' || column.databaseName === 'local_id',
    );
    if (!hasLocalId) {
      throw new Error(`Entity ${meta.tableName} is not tenant scoped`);
    }

    qb.andWhere(`${alias}.localId = :tenantLocalId`, {
      tenantLocalId: localId,
    });
    return qb;
  }

  async getByIdOrNotFound<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
    id: string,
    alias = 'row',
  ): Promise<T> {
    const scoped = await this.forEntity(entity, alias)
      .andWhere(`${alias}.id = :id`, { id })
      .getOne();
    if (scoped) {
      return scoped;
    }

    const existing = await this.loadUnscopedForAuthzLog(entity, alias, id);
    if (existing) {
      this.logCrossLocal(id, this.resourceLocalId(existing));
    }
    throw new NotFoundException();
  }

  private async loadUnscopedForAuthzLog<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
    alias: string,
    id: string,
  ): Promise<T | null> {
    const meta = this.dataSource.getMetadata(entity);
    const qb = this.dataSource
      .getRepository(entity)
      .createQueryBuilder(alias)
      .andWhere(`${alias}.id = :id`, { id });
    if (meta.tableName === 'announcement_recipients') {
      qb.innerJoinAndSelect(`${alias}.announcement`, `${alias}_announcement`);
    }
    return qb.getOne();
  }

  private resourceLocalId(row: ObjectLiteral): string {
    if (typeof row.localId === 'string') {
      return row.localId;
    }
    if (
      typeof row.id === 'string' &&
      !('localId' in row) &&
      !row.announcement
    ) {
      return row.id;
    }
    const announcement = row.announcement as { localId?: string } | undefined;
    return announcement?.localId ?? '-';
  }

  private logCrossLocal(resourceId: string, resourceLocalId: string): void {
    const user = this.request.user;
    this.logger.warn(
      `authz denied memberId=${user?.memberId ?? '-'} localId=${user?.localId ?? '-'} resourceLocalId=${resourceLocalId} resourceId=${resourceId} path=${this.request.method} ${this.request.originalUrl} reason=cross-local`,
    );
  }

  private requireLocalId(): string {
    const localId = this.request.user?.localId;
    if (!localId) {
      throw new Error('TenantScope requires an authenticated user');
    }
    return localId;
  }
}
