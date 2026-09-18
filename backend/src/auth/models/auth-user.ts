import type { MemberRole } from '../../common/enums';

export type AuthUser = {
  userId: string;
  memberId: string;
  localId: string;
  role: MemberRole;
};
