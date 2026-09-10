import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class InitSchema1760000000000 implements MigrationInterface {
  name = 'InitSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'locals',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'text', isNullable: false },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'email', type: 'text', isNullable: false, isUnique: true },
          { name: 'password_hash', type: 'text', isNullable: false },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'members',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'local_id', type: 'uuid', isNullable: false },
          { name: 'full_name', type: 'text', isNullable: false },
          { name: 'email', type: 'text', isNullable: false },
          { name: 'classification', type: 'text', isNullable: false },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'role', type: 'text', isNullable: false },
          { name: 'user_id', type: 'uuid', isNullable: false, isUnique: true },
        ],
        foreignKeys: [
          {
            columnNames: ['local_id'],
            referencedTableName: 'locals',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
          },
        ],
        indices: [
          {
            name: 'IDX_members_local_id_status',
            columnNames: ['local_id', 'status'],
          },
          {
            name: 'IDX_members_local_id_classification_status',
            columnNames: ['local_id', 'classification', 'status'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'announcements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'local_id', type: 'uuid', isNullable: false },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'body', type: 'text', isNullable: false },
          {
            name: 'needs_ack',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          { name: 'sent_at', type: 'timestamptz', isNullable: true },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'requires_attendance',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'created_by', type: 'uuid', isNullable: false },
          {
            name: 'sent_count',
            type: 'int',
            isNullable: false,
            default: 0,
          },
          {
            name: 'read_count',
            type: 'int',
            isNullable: false,
            default: 0,
          },
          {
            name: 'acknowledged_count',
            type: 'int',
            isNullable: false,
            default: 0,
          },
          {
            name: 'notification_preview',
            type: 'text',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['local_id'],
            referencedTableName: 'locals',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['created_by'],
            referencedTableName: 'members',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'announcement_recipients',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'announcement_id', type: 'uuid', isNullable: false },
          { name: 'member_id', type: 'uuid', isNullable: false },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'read_at', type: 'timestamptz', isNullable: true },
          { name: 'acknowledged_at', type: 'timestamptz', isNullable: true },
          { name: 'attendance_response', type: 'text', isNullable: true },
          { name: 'sent_at', type: 'timestamptz', isNullable: true },
          {
            name: 'attempt_count',
            type: 'int',
            isNullable: false,
            default: 0,
          },
          { name: 'next_attempt_at', type: 'timestamptz', isNullable: true },
        ],
        uniques: [
          {
            name: 'UQ_announcement_recipients_announcement_member',
            columnNames: ['announcement_id', 'member_id'],
          },
        ],
        foreignKeys: [
          {
            columnNames: ['announcement_id'],
            referencedTableName: 'announcements',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['member_id'],
            referencedTableName: 'members',
            referencedColumnNames: ['id'],
          },
        ],
        indices: [
          {
            name: 'IDX_announcement_recipients_status_next_attempt_at',
            columnNames: ['status', 'next_attempt_at'],
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('announcement_recipients');
    await queryRunner.dropTable('announcements');
    await queryRunner.dropTable('members');
    await queryRunner.dropTable('users');
    await queryRunner.dropTable('locals');
  }
}
