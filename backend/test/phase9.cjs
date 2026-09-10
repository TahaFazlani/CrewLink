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
const { Announcement } = require('../dist/announcements/announcement.entity');
const {
  AnnouncementRecipient,
} = require('../dist/announcements/announcement-recipient.entity');
const { DataSource } = require('typeorm');

const PASSWORD = 'password123';

async function upsertAccount(
  dataSource,
  local,
  email,
  fullName,
  role,
  classification,
  status,
  passwordHash,
) {
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
    member = await members.save(
      members.create({
        localId: local.id,
        fullName,
        email,
        classification,
        status,
        role,
        userId: user.id,
      }),
    );
  } else {
    member.localId = local.id;
    member.fullName = fullName;
    member.email = email;
    member.role = role;
    member.status = status;
    member.classification = classification;
    member = await members.save(member);
  }
  return member;
}

function bodyText(res) {
  return JSON.stringify(res.body ?? {});
}

function assertNoPii(res, forbidden) {
  const text = bodyText(res).toLowerCase();
  for (const value of forbidden) {
    assert.equal(
      text.includes(String(value).toLowerCase()),
      false,
      `response leaked ${value}: ${text}`,
    );
  }
}

async function login(server, email) {
  const res = await request(server)
    .post('/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  assert.ok(res.body.accessToken);
  return res.body;
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  const server = app.getHttpServer();
  const dataSource = app.get(DataSource);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const locals = dataSource.getRepository(Local);
  let localA = await locals.findOne({ where: { name: 'E2E Local A' } });
  if (!localA) {
    localA = await locals.save(locals.create({ name: 'E2E Local A' }));
  }
  let localB = await locals.findOne({ where: { name: 'E2E Local B' } });
  if (!localB) {
    localB = await locals.save(locals.create({ name: 'E2E Local B' }));
  }

  const leadA = await upsertAccount(
    dataSource,
    localA,
    'e2e.a.lead@crewlink.local',
    'E2E A Lead',
    'leadership',
    'Journeyman Wireman',
    'active',
    passwordHash,
  );
  const memberA = await upsertAccount(
    dataSource,
    localA,
    'e2e.a.member@crewlink.local',
    'E2E A Member',
    'member',
    'Apprentice 3rd Year',
    'active',
    passwordHash,
  );
  const retiredA = await upsertAccount(
    dataSource,
    localA,
    'e2e.a.retired@crewlink.local',
    'E2E A Retired',
    'member',
    'Journeyman Wireman',
    'retired',
    passwordHash,
  );
  const suspendedA = await upsertAccount(
    dataSource,
    localA,
    'e2e.a.suspended@crewlink.local',
    'E2E A Suspended',
    'member',
    'Sheet Metal Worker',
    'suspended',
    passwordHash,
  );
  const leadB = await upsertAccount(
    dataSource,
    localB,
    'e2e.b.lead@crewlink.local',
    'E2E B Lead',
    'leadership',
    'Journeyman Wireman',
    'active',
    passwordHash,
  );
  const memberB = await upsertAccount(
    dataSource,
    localB,
    'e2e.b.member@crewlink.local',
    'E2E B Member Secret',
    'member',
    'Transit Operator',
    'active',
    passwordHash,
  );

  const tokenLeadA = (await login(server, 'e2e.a.lead@crewlink.local'))
    .accessToken;
  const tokenMemberA = (await login(server, 'e2e.a.member@crewlink.local'))
    .accessToken;
  const tokenLeadB = (await login(server, 'e2e.b.lead@crewlink.local'))
    .accessToken;
  const tokenMemberB = (await login(server, 'e2e.b.member@crewlink.local'))
    .accessToken;

  const createdB = await request(server)
    .post('/announcements')
    .set('Authorization', `Bearer ${tokenLeadB}`)
    .send({
      title: 'Local B only',
      body: `do not leak ${memberB.fullName} ${memberB.email}`,
    })
    .expect(201);
  await request(server)
    .post(`/announcements/${createdB.body.id}/approve`)
    .set('Authorization', `Bearer ${tokenLeadB}`)
    .expect(201);
  await request(server)
    .post(`/announcements/${createdB.body.id}/send`)
    .set('Authorization', `Bearer ${tokenLeadB}`)
    .send({})
    .expect(202);
  const foreignId = createdB.body.id;
  await request(server)
    .get(`/me/announcements/${foreignId}`)
    .set('Authorization', `Bearer ${tokenMemberB}`)
    .expect(200);
  const pii = [
    memberB.fullName,
    memberB.email,
    memberB.id,
    'E2E B Member Secret',
  ];

  const crossLead = await request(server)
    .get(`/announcements/${foreignId}`)
    .set('Authorization', `Bearer ${tokenLeadA}`);
  assert.notEqual(crossLead.status, 200);
  assert.equal(crossLead.status, 404);
  assertNoPii(crossLead, pii);

  const crossMember = await request(server)
    .get(`/me/announcements/${foreignId}`)
    .set('Authorization', `Bearer ${tokenMemberA}`);
  assert.notEqual(crossMember.status, 200);
  assert.equal(crossMember.status, 404);
  assertNoPii(crossMember, pii);

  const crossLocal = await request(server)
    .get(`/locals/${localB.id}`)
    .set('Authorization', `Bearer ${tokenLeadA}`);
  assert.equal(crossLocal.status, 404);
  assertNoPii(crossLocal, pii);

  const crossMemberIdAsAnnouncement = await request(server)
    .get(`/announcements/${memberB.id}`)
    .set('Authorization', `Bearer ${tokenLeadA}`);
  assert.equal(crossMemberIdAsAnnouncement.status, 404);
  assertNoPii(crossMemberIdAsAnnouncement, pii);

  const crossMeMemberId = await request(server)
    .get(`/me/announcements/${memberB.id}`)
    .set('Authorization', `Bearer ${tokenMemberA}`);
  assert.equal(crossMeMemberId.status, 404);
  assertNoPii(crossMeMemberId, pii);

  const createdA = await request(server)
    .post('/announcements')
    .set('Authorization', `Bearer ${tokenLeadA}`)
    .send({ title: 'Local A ack', body: 'read then ack', needsAck: true })
    .expect(201);
  await request(server)
    .post(`/announcements/${createdA.body.id}/approve`)
    .set('Authorization', `Bearer ${tokenLeadA}`)
    .expect(201);

  const memberSend = await request(server)
    .post(`/announcements/${createdA.body.id}/send`)
    .set('Authorization', `Bearer ${tokenMemberA}`)
    .send({});
  assert.equal(memberSend.status, 403);

  const memberApprove = await request(server)
    .post(`/announcements/${createdA.body.id}/approve`)
    .set('Authorization', `Bearer ${tokenMemberA}`);
  assert.equal(memberApprove.status, 403);

  const memberAi = await request(server)
    .post('/announcements/ai-draft')
    .set('Authorization', `Bearer ${tokenMemberA}`)
    .send({ note: 'should not draft' });
  assert.equal(memberAi.status, 403);

  await request(server)
    .post(`/announcements/${createdA.body.id}/send`)
    .set('Authorization', `Bearer ${tokenLeadA}`)
    .send({})
    .expect(202);

  const recipients = await dataSource.getRepository(AnnouncementRecipient).find({
    where: { announcementId: createdA.body.id },
  });
  const recipientMemberIds = new Set(recipients.map((row) => row.memberId));
  assert.equal(recipientMemberIds.has(memberA.id), true);
  assert.equal(recipientMemberIds.has(retiredA.id), false);
  assert.equal(recipientMemberIds.has(suspendedA.id), false);
  assert.equal(recipientMemberIds.has(leadA.id), false);

  const audienceStatuses = await dataSource.query(
    `SELECT m.status, m.role, COUNT(*)::int AS n
     FROM announcement_recipients r
     JOIN members m ON m.id = r.member_id
     WHERE r.announcement_id = $1
     GROUP BY m.status, m.role`,
    [createdA.body.id],
  );
  assert.deepEqual(audienceStatuses, [{ status: 'active', role: 'member', n: 1 }]);

  const beforeRead = await request(server)
    .get(`/announcements/${createdA.body.id}`)
    .set('Authorization', `Bearer ${tokenLeadA}`)
    .expect(200);

  await request(server)
    .get(`/me/announcements/${createdA.body.id}`)
    .set('Authorization', `Bearer ${tokenMemberA}`)
    .expect(200);
  await request(server)
    .get(`/me/announcements/${createdA.body.id}`)
    .set('Authorization', `Bearer ${tokenMemberA}`)
    .expect(200);

  const afterRead = await request(server)
    .get(`/announcements/${createdA.body.id}`)
    .set('Authorization', `Bearer ${tokenLeadA}`)
    .expect(200);
  assert.equal(afterRead.body.readCount, beforeRead.body.readCount + 1);

  await request(server)
    .post(`/me/announcements/${createdA.body.id}/acknowledge`)
    .set('Authorization', `Bearer ${tokenMemberA}`)
    .expect(201);
  await request(server)
    .post(`/me/announcements/${createdA.body.id}/acknowledge`)
    .set('Authorization', `Bearer ${tokenMemberA}`)
    .expect(201);

  const afterAck = await request(server)
    .get(`/announcements/${createdA.body.id}`)
    .set('Authorization', `Bearer ${tokenLeadA}`)
    .expect(200);
  assert.equal(afterAck.body.acknowledgedCount, beforeRead.body.acknowledgedCount + 1);

  const seedEmails = [
    'leadership.27@crewlink.local',
    'member.27@crewlink.local',
    'leadership.99@crewlink.local',
    'member.99@crewlink.local',
  ];
  const seedLogins = {};
  for (const email of seedEmails) {
    const body = await login(server, email);
    seedLogins[email] = body;
    const expectedLocal = email.includes('.27@') ? 'Local 27' : 'Local 99';
    const expectedRole = email.startsWith('leadership')
      ? 'leadership'
      : 'member';
    assert.equal(body.member.role, expectedRole);
    const localRow = await dataSource.getRepository(Local).findOne({
      where: { id: body.member.localId },
    });
    assert.equal(localRow?.name, expectedLocal);
  }

  const seeded = await dataSource.getRepository(Announcement).findOne({
    where: { title: '[SEED] Thursday emergency meeting' },
  });
  assert.ok(seeded, 'run npm run seed before phase 9');

  const l27Lead = seedLogins['leadership.27@crewlink.local'].accessToken;
  const l27Member = seedLogins['member.27@crewlink.local'].accessToken;
  const l99Lead = seedLogins['leadership.99@crewlink.local'].accessToken;
  const l99Member = seedLogins['member.99@crewlink.local'].accessToken;
  const otherMember = seedLogins['member.99@crewlink.local'].member;

  const seedOk = await request(server)
    .get(`/announcements/${seeded.id}`)
    .set('Authorization', `Bearer ${l27Lead}`)
    .expect(200);
  assert.equal(seedOk.body.localId, seeded.localId);

  const seedCross = await request(server)
    .get(`/announcements/${seeded.id}`)
    .set('Authorization', `Bearer ${l99Lead}`);
  assert.equal(seedCross.status, 404);
  assertNoPii(seedCross, [
    'Alex Rivera',
    'member.27@crewlink.local',
    seedLogins['member.27@crewlink.local'].member.id,
  ]);

  const seedMemberOk = await request(server)
    .get(`/me/announcements/${seeded.id}`)
    .set('Authorization', `Bearer ${l27Member}`)
    .expect(200);
  assert.equal(seedMemberOk.body.id, seeded.id);

  const seedMemberCross = await request(server)
    .get(`/me/announcements/${seeded.id}`)
    .set('Authorization', `Bearer ${l99Member}`);
  assert.equal(seedMemberCross.status, 404);
  assertNoPii(seedMemberCross, ['Alex Rivera', 'member.27@crewlink.local']);

  const otherIdAsResource = await request(server)
    .get(`/announcements/${otherMember.id}`)
    .set('Authorization', `Bearer ${l27Lead}`);
  assert.equal(otherIdAsResource.status, 404);
  assertNoPii(otherIdAsResource, [
    otherMember.id,
    'Jordan Chen',
    'member.99@crewlink.local',
  ]);

  await app.close();
  console.log(
    'phase 9: cross-local 404, member 403, audience excludes retired/suspended/leadership, ack/read once, four seed logins',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
