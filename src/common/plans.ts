/**
 * What each plan includes. One table, read by usage limits, upload storage,
 * and the AI assistant, so the checks and the numbers on the pricing page
 * (frontend/lib/plans.ts) have one source each side.
 *
 * Projects, collaborators, the editor, compiling, the TikZ studio, and the API
 * are the same on every plan: there is no limit on them. Plans differ only in
 * what costs money to run: conversions, upload storage, and the AI models.
 *
 * -1 means unlimited.
 */
export type PlanId = 'free' | 'pro' | 'team' | 'enterprise';

export interface PlanAllowance {
  /** Image-to-LaTeX conversions per calendar month. */
  snipsPerMonth: number;
  /** PDF pages converted per calendar month. */
  pdfPagesPerMonth: number;
  /** Bytes of uploaded PDFs and images kept at once. */
  uploadStorageBytes: number;
  /** The editor's AI assistant and dictation, which call paid models. */
  aiAssistant: boolean;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLAN_ALLOWANCES: Record<PlanId, PlanAllowance> = {
  free: { snipsPerMonth: 20, pdfPagesPerMonth: 40, uploadStorageBytes: 100 * MB, aiAssistant: false },
  pro: { snipsPerMonth: 300, pdfPagesPerMonth: 200, uploadStorageBytes: 5 * GB, aiAssistant: true },
  team: { snipsPerMonth: -1, pdfPagesPerMonth: 2000, uploadStorageBytes: 50 * GB, aiAssistant: true },
  enterprise: { snipsPerMonth: -1, pdfPagesPerMonth: -1, uploadStorageBytes: 500 * GB, aiAssistant: true },
};

export function planAllowance(subscriptionType: string | null | undefined): PlanAllowance {
  const id = (subscriptionType || 'free').toLowerCase() as PlanId;
  return PLAN_ALLOWANCES[id] ?? PLAN_ALLOWANCES.free;
}

/** "100 MB", "5 GB": for messages. */
export function formatBytes(bytes: number): string {
  return bytes >= GB ? `${Math.round(bytes / GB)} GB` : `${Math.round(bytes / MB)} MB`;
}
