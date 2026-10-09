export type FeedbackCategory = 'FEATURE' | 'IMPROVEMENT' | 'BUG' | 'PRIVATE';
export type FeedbackStatus = 'OPEN' | 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'DECLINED';

export interface FeedbackPost {
  id: string;
  title: string;
  body: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  authorName: string;
  /** likes */
  voteCount: number;
  /** dislikes */
  downCount: number;
  commentCount: number;
  createdAt: string;
  /** this visitor's reaction: 1 like, -1 dislike, 0 none */
  myVote: number;
  mine: boolean;
  /** list only: the latest contributions (oldest first) */
  recent?: { id: string; authorName: string; isTeam: boolean; body: string; createdAt: string }[];
}

export interface FeedbackComment {
  id: string;
  authorName: string;
  isTeam: boolean;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface FeedbackDetail extends FeedbackPost {
  comments: FeedbackComment[];
}

export interface FeedbackPage {
  data: FeedbackPost[];
  meta: { total: number; page: number; pageSize: number; pageCount: number; statusCounts: Partial<Record<FeedbackStatus, number>> };
}

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = { FEATURE: 'Feature request', IMPROVEMENT: 'Improvement', BUG: 'Bug', PRIVATE: 'Private' };

/** shown in the "Type" picker */
export const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'FEATURE', label: 'Feature request' },
  { value: 'IMPROVEMENT', label: 'Improvement' },
  { value: 'BUG', label: 'Bug' },
  { value: 'PRIVATE', label: 'Private — only the team sees it' },
];

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  OPEN: 'Open',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  DECLINED: 'Not planned',
};

/** pill colours per status */
export const STATUS_TONE: Record<FeedbackStatus, string> = {
  OPEN: 'bg-panel text-ink-soft',
  PLANNED: 'bg-primary-soft text-primary',
  IN_PROGRESS: 'bg-warning-soft text-warning',
  DONE: 'bg-positive-soft text-positive',
  DECLINED: 'bg-panel text-muted',
};

export const feedbackKeys = {
  list: (q: object) => ['feedback', q] as const,
  post: (id: string) => ['feedback-post', id] as const,
};
