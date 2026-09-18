export const AI_DRAFT_PORT = Symbol('AI_DRAFT_PORT');

export type AiDraftFields = {
  title: string;
  body: string;
  notificationPreview: string;
};

export interface AiDraftPort {
  draftFromNote(note: string): Promise<AiDraftFields>;
}
