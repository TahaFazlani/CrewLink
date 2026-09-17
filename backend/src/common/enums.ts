export type MemberStatus = 'active' | 'retired' | 'suspended';
export type MemberRole = 'member' | 'leadership';
export type AnnouncementStatus = 'draft' | 'approved' | 'sent';
export type RecipientStatus = 'queued' | 'sent' | 'failed';
export type AttendanceResponse = 'coming' | 'not_coming';

export const MEMBER_CLASSIFICATIONS = [
  'Journeyman Wireman',
  'Apprentice 3rd Year',
  'Sheet Metal Worker',
  'Transit Operator',
] as const;

export type MemberClassification = (typeof MEMBER_CLASSIFICATIONS)[number];
