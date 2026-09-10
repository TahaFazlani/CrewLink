import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AnnouncementRecipient } from '../announcements/announcement-recipient.entity';
import { Announcement } from '../announcements/announcement.entity';
import { User } from '../auth/user.entity';
import type { MemberRole, MemberStatus } from '../common/enums';
import dataSource from '../data-source';
import { Local } from '../locals/local.entity';
import { Member } from '../members/member.entity';

const PASSWORD = 'password123';

const CLASSIFICATIONS = [
  'Journeyman Wireman',
  'Apprentice 3rd Year',
  'Sheet Metal Worker',
  'Transit Operator',
] as const;

const LOGIN_ACCOUNTS = [
  {
    localName: 'Local 27',
    email: 'leadership.27@crewlink.local',
    fullName: 'Denise Okafor',
    role: 'leadership' as const,
    classification: 'Journeyman Wireman',
  },
  {
    localName: 'Local 27',
    email: 'member.27@crewlink.local',
    fullName: 'Alex Rivera',
    role: 'member' as const,
    classification: 'Apprentice 3rd Year',
  },
  {
    localName: 'Local 99',
    email: 'leadership.99@crewlink.local',
    fullName: 'Sam Okonkwo',
    role: 'leadership' as const,
    classification: 'Journeyman Wireman',
  },
  {
    localName: 'Local 99',
    email: 'member.99@crewlink.local',
    fullName: 'Jordan Chen',
    role: 'member' as const,
    classification: 'Apprentice 3rd Year',
  },
];

const SEED_ANNOUNCEMENT_TITLE = '[SEED] Thursday emergency meeting';
const LOCAL_27_ROSTER = 1998;
const LOCAL_99_ROSTER = 198;
const CHUNK = 400;

function statusForIndex(i: number): MemberStatus {
  if (i % 20 === 0) {
    return 'retired';
  }
  if (i % 20 === 1) {
    return 'suspended';
  }
  return 'active';
}

async function upsertLocal(name: string): Promise<Local> {
  const repo = dataSource.getRepository(Local);
  let local = await repo.findOne({ where: { name } });
  if (!local) {
    local = await repo.save(repo.create({ name }));
  }
  return local;
}

async function upsertLogin(
  spec: (typeof LOGIN_ACCOUNTS)[number],
  local: Local,
  passwordHash: string,
): Promise<Member> {
  const users = dataSource.getRepository(User);
  const members = dataSource.getRepository(Member);
  let user = await users.findOne({ where: { email: spec.email } });
  if (!user) {
    user = await users.save(users.create({ email: spec.email, passwordHash }));
  } else {
    user.passwordHash = passwordHash;
    user = await users.save(user);
  }
  let member = await members.findOne({ where: { userId: user.id } });
  if (!member) {
    member = await members.save(
      members.create({
        localId: local.id,
        fullName: spec.fullName,
        email: spec.email,
        classification: spec.classification,
        status: 'active',
        role: spec.role,
        userId: user.id,
      }),
    );
  } else {
    member.localId = local.id;
    member.fullName = spec.fullName;
    member.email = spec.email;
    member.classification = spec.classification;
    member.status = 'active';
    member.role = spec.role;
    member = await members.save(member);
  }
  return member;
}

async function existingRosterEmails(prefix: string): Promise<Set<string>> {
  const rows: { email: string }[] = await dataSource.query(
    `SELECT email FROM users WHERE email LIKE $1`,
    [`${prefix}%`],
  );
  return new Set(rows.map((row) => row.email));
}

async function insertRoster(
  local: Local,
  prefix: string,
  count: number,
  passwordHash: string,
): Promise<void> {
  const have = await existingRosterEmails(prefix);
  const users: Array<{ id: string; email: string; passwordHash: string }> = [];
  const members: Array<{
    id: string;
    localId: string;
    fullName: string;
    email: string;
    classification: string;
    status: MemberStatus;
    role: MemberRole;
    userId: string;
  }> = [];

  for (let i = 1; i <= count; i += 1) {
    const email = `${prefix}${String(i).padStart(4, '0')}@crewlink.seed`;
    if (have.has(email)) {
      continue;
    }
    const userId = randomUUID();
    users.push({ id: userId, email, passwordHash });
    members.push({
      id: randomUUID(),
      localId: local.id,
      fullName: `Roster ${local.name} #${i}`,
      email,
      classification: CLASSIFICATIONS[(i - 1) % CLASSIFICATIONS.length],
      status: statusForIndex(i),
      role: 'member',
      userId,
    });
  }

  const userRepo = dataSource.getRepository(User);
  const memberRepo = dataSource.getRepository(Member);
  for (let i = 0; i < users.length; i += CHUNK) {
    await userRepo.insert(users.slice(i, i + CHUNK));
    await memberRepo.insert(members.slice(i, i + CHUNK));
  }
}

async function seedSentAnnouncement(
  local27: Local,
  createdBy: Member,
): Promise<Announcement> {
  const announcements = dataSource.getRepository(Announcement);
  const recipients = dataSource.getRepository(AnnouncementRecipient);

  let announcement = await announcements.findOne({
    where: { localId: local27.id, title: SEED_ANNOUNCEMENT_TITLE },
  });

  const audience = await dataSource.getRepository(Member).find({
    where: {
      localId: local27.id,
      role: 'member',
      status: 'active',
    },
  });

  if (!announcement) {
    const sentAt = new Date();
    announcement = await announcements.save(
      announcements.create({
        localId: local27.id,
        createdById: createdBy.id,
        title: SEED_ANNOUNCEMENT_TITLE,
        body: 'Emergency meeting Thursday 6pm at the hall. Contractor is pulling crews off the westside job. Everyone needs to be there — this is the third time.',
        notificationPreview: 'Thu 6pm hall: emergency mtg, westside contractor crews.',
        needsAck: true,
        requiresAttendance: false,
        status: 'sent',
        sentAt,
        sentCount: 0,
        readCount: 0,
        acknowledgedCount: 0,
      }),
    );
  }

  const seeded = announcement;
  const existingCount = await recipients.count({
    where: { announcementId: seeded.id },
  });
  if (existingCount === 0 && audience.length > 0) {
    const sentAt = seeded.sentAt ?? new Date();
    const rows = audience.map((member, index) => {
      const read = index < 200;
      const ack = index < 80;
      return {
        id: randomUUID(),
        announcementId: seeded.id,
        memberId: member.id,
        status: 'sent' as const,
        sentAt,
        readAt: read ? sentAt : null,
        acknowledgedAt: ack ? sentAt : null,
        attendanceResponse: null,
        attemptCount: 1,
        nextAttemptAt: null,
      };
    });
    for (let i = 0; i < rows.length; i += CHUNK) {
      await recipients.insert(rows.slice(i, i + CHUNK));
    }
  }

  const recs = await recipients.find({
    where: { announcementId: seeded.id },
  });
  const sentCount = recs.filter((row) => row.status === 'sent').length;
  const readCount = recs.filter((row) => row.readAt != null).length;
  const acknowledgedCount = recs.filter(
    (row) => row.acknowledgedAt != null,
  ).length;
  seeded.sentCount = sentCount;
  seeded.readCount = readCount;
  seeded.acknowledgedCount = acknowledgedCount;
  if (!seeded.sentAt) {
    seeded.sentAt = new Date();
  }
  seeded.status = 'sent';
  return announcements.save(seeded);
}

async function main(): Promise<void> {
  await dataSource.initialize();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const local27 = await upsertLocal('Local 27');
  const local99 = await upsertLocal('Local 99');

  const logins: Record<string, Member> = {};
  const accounts = [];
  for (const spec of LOGIN_ACCOUNTS) {
    const local = spec.localName === 'Local 27' ? local27 : local99;
    const member = await upsertLogin(spec, local, passwordHash);
    logins[spec.email] = member;
    accounts.push({
      email: spec.email,
      password: PASSWORD,
      role: spec.role,
      localName: spec.localName,
      localId: local.id,
      memberId: member.id,
    });
  }

  await insertRoster(
    local27,
    'roster.l27.',
    LOCAL_27_ROSTER,
    passwordHash,
  );
  await insertRoster(
    local99,
    'roster.l99.',
    LOCAL_99_ROSTER,
    passwordHash,
  );

  const announcement = await seedSentAnnouncement(
    local27,
    logins['leadership.27@crewlink.local'],
  );

  const memberCount27 = await dataSource.getRepository(Member).count({
    where: { localId: local27.id },
  });
  const memberCount99 = await dataSource.getRepository(Member).count({
    where: { localId: local99.id },
  });
  const activeMembers27 = await dataSource.getRepository(Member).count({
    where: { localId: local27.id, role: 'member', status: 'active' },
  });

  console.log('seed complete');
  console.log(
    JSON.stringify(
      {
        locals: {
          local27: { id: local27.id, name: local27.name, members: memberCount27 },
          local99: { id: local99.id, name: local99.name, members: memberCount99 },
        },
        accounts,
        existingAnnouncementId: announcement.id,
        otherLocalMemberId: logins['member.99@crewlink.local'].id,
        sentAnnouncement: {
          title: announcement.title,
          status: announcement.status,
          sentCount: announcement.sentCount,
          readCount: announcement.readCount,
          acknowledgedCount: announcement.acknowledgedCount,
          activeMemberAudience: activeMembers27,
        },
      },
      null,
      2,
    ),
  );

  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
