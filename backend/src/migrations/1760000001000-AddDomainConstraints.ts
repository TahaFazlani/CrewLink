import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDomainConstraints1760000001000 implements MigrationInterface {
  name = 'AddDomainConstraints1760000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE members
      ADD CONSTRAINT "CHK_members_status"
        CHECK (status IN ('active', 'retired', 'suspended')),
      ADD CONSTRAINT "CHK_members_role"
        CHECK (role IN ('member', 'leadership'))
    `);
    await queryRunner.query(`
      ALTER TABLE announcements
      ADD CONSTRAINT "CHK_announcements_status"
        CHECK (status IN ('draft', 'approved', 'sent'))
    `);
    await queryRunner.query(`
      ALTER TABLE announcement_recipients
      ADD CONSTRAINT "CHK_recipients_status"
        CHECK (status IN ('queued', 'sent', 'failed')),
      ADD CONSTRAINT "CHK_recipients_attendance_response"
        CHECK (
          attendance_response IS NULL OR
          attendance_response IN ('coming', 'not_coming')
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE announcement_recipients
      DROP CONSTRAINT "CHK_recipients_attendance_response",
      DROP CONSTRAINT "CHK_recipients_status"
    `);
    await queryRunner.query(`
      ALTER TABLE announcements
      DROP CONSTRAINT "CHK_announcements_status"
    `);
    await queryRunner.query(`
      ALTER TABLE members
      DROP CONSTRAINT "CHK_members_role",
      DROP CONSTRAINT "CHK_members_status"
    `);
  }
}
