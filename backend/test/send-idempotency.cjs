const path = require('node:path');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  override: true,
});
process.env.WORKER_ENABLED = 'false';

require('reflect-metadata');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const request = require('supertest');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');
const { Local } = require('../dist/locals/local.entity');
const { User } = require('../dist/auth/user.entity');
const { Member } = require('../dist/members/member.entity');
const {
  AnnouncementRecipient,
} = require('../dist/announcements/announcement-recipient.entity');
const { DataSource } = require('typeorm');

async function upsertAccount(dataSource, local, email, fullName, role, classification, passwordHash) {
  const users = dataSource.getRepository(User);
  const members = dataSource.getRepository(Member);
  let user = await users.findOne({ where: { email } });
  if (!user) {
    user = await users.save(users.create({ email, passwordHash }));
  } else {
    user.passwordHash = passwordHash;
    user = await users.save(user);
  }
  let member = await members.findOne({ where: { userId: user.id } });
  if (!member) {
    await members.save(
      members.create({
        localId: local.id,
        fullName,
        email,
        classification,
        status: 'active',
        role,
        userId: user.id,
      }),
    );
  } else {
    member.localId = local.id;
    member.role = role;
    member.status = 'active';
    member.classification = classification;
    await members.save(member);
  }
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  const server = app.getHttpServer();
  const dataSource = app.get(DataSource);

  const passwordHash = await bcrypt.hash('password123', 10);
  const locals = dataSource.getRepository(Local);
  let local = await locals.findOne({ where: { name: 'E2E Rule2 Local' } });
  if (!local) {
    local = await locals.save(locals.create({ name: 'E2E Rule2 Local' }));
  }

  await upsertAccount(
    dataSource,
    local,
    'e2e.lead@crewlink.local',
    'E2E Lead',
    'leadership',
    'Journeyman Wireman',
    passwordHash,
  );
  await upsertAccount(
    dataSource,
    local,
    'e2e.m1@crewlink.local',
    'E2E Member One',
    'member',
    'Apprentice 3rd Year',
    passwordHash,
  );
  await upsertAccount(
    dataSource,
    local,
    'e2e.m2@crewlink.local',
    'E2E Member Two',
    'member',
    'Journeyman Wireman',
    passwordHash,
  );

  const login = await request(server)
    .post('/auth/login')
    .send({ email: 'e2e.lead@crewlink.local', password: 'password123' })
    .expect(200);
  const token = login.body.accessToken;

  const created = await request(server)
    .post('/announcements')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Rule 2', body: 'Do not double-send' })
    .expect(201);
  const id = created.body.id;

  await request(server)
    .post(`/announcements/${id}/approve`)
    .set('Authorization', `Bearer ${token}`)
    .expect(201);

  const first = await request(server)
    .post(`/announcements/${id}/send`)
    .set('Authorization', `Bearer ${token}`)
    .send({})
    .expect(202);

  const second = await request(server)
    .post(`/announcements/${id}/send`)
    .set('Authorization', `Bearer ${token}`)
    .send({})
    .expect(202);

  const rows = await dataSource.getRepository(AnnouncementRecipient).find({
    where: { announcementId: id },
  });
  const uniqueMembers = new Set(rows.map((row) => row.memberId));
  const audienceCount = await dataSource.getRepository(Member).count({
    where: { localId: local.id, role: 'member', status: 'active' },
  });

  assert.equal(rows.length, audienceCount);
  assert.ok(audienceCount >= 2);
  assert.equal(uniqueMembers.size, rows.length);
  assert.equal(first.body.sentCount, 0);
  assert.equal(second.body.sentCount, first.body.sentCount);
  assert.equal(first.body.status, 'sent');
  assert.equal(second.body.status, 'sent');

  const duplicates = await dataSource.query(
    `SELECT member_id, COUNT(*)::int AS n
     FROM announcement_recipients
     WHERE announcement_id = $1
     GROUP BY member_id
     HAVING COUNT(*) > 1`,
    [id],
  );
  assert.deepEqual(duplicates, []);

  const leadershipRecipients = await dataSource.query(
    `SELECT r.id
     FROM announcement_recipients r
     JOIN members m ON m.id = r.member_id
     WHERE r.announcement_id = $1 AND m.role = 'leadership'`,
    [id],
  );
  assert.deepEqual(leadershipRecipients, []);

  await app.close();
  console.log('send twice: no duplicate recipient rows, sent_count unchanged');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
