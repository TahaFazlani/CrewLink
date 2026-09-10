import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import { User } from '../auth/user.entity';
import { Local } from '../locals/local.entity';
import { Member } from '../members/member.entity';

const PASSWORD = 'password123';

const ACCOUNTS = [
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

async function upsertLocal(name: string): Promise<Local> {
  const repo = dataSource.getRepository(Local);
  let local = await repo.findOne({ where: { name } });
  if (!local) {
    local = repo.create({ name });
    local = await repo.save(local);
  }
  return local;
}

async function upsertAccount(
  spec: (typeof ACCOUNTS)[number],
  local: Local,
  passwordHash: string,
): Promise<{ user: User; member: Member }> {
  const users = dataSource.getRepository(User);
  const members = dataSource.getRepository(Member);

  let user = await users.findOne({ where: { email: spec.email } });
  if (!user) {
    user = users.create({ email: spec.email, passwordHash });
    user = await users.save(user);
  } else {
    user.passwordHash = passwordHash;
    user = await users.save(user);
  }

  let member = await members.findOne({ where: { userId: user.id } });
  if (!member) {
    member = members.create({
      localId: local.id,
      fullName: spec.fullName,
      email: spec.email,
      classification: spec.classification,
      status: 'active',
      role: spec.role,
      userId: user.id,
    });
    member = await members.save(member);
  } else {
    member.localId = local.id;
    member.fullName = spec.fullName;
    member.email = spec.email;
    member.classification = spec.classification;
    member.status = 'active';
    member.role = spec.role;
    member = await members.save(member);
  }

  return { user, member };
}

async function main(): Promise<void> {
  await dataSource.initialize();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const local27 = await upsertLocal('Local 27');
  const local99 = await upsertLocal('Local 99');
  const localsByName = { 'Local 27': local27, 'Local 99': local99 };

  const seeded = [];
  for (const spec of ACCOUNTS) {
    const local = localsByName[spec.localName as 'Local 27' | 'Local 99'];
    const { user, member } = await upsertAccount(spec, local, passwordHash);
    seeded.push({
      email: spec.email,
      password: PASSWORD,
      role: spec.role,
      localName: spec.localName,
      localId: local.id,
      memberId: member.id,
      userId: user.id,
    });
  }

  console.log('seed:dev complete');
  console.log(JSON.stringify({ locals: { local27, local99 }, accounts: seeded }, null, 2));
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
