'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, Lightbulb, MessageSquare, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/misc';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { FeedbackDetail, feedbackKeys, FeedbackPost } from '@/lib/feedback';
import type { FeedbackPage } from '@/lib/feedback';
import { Avatar, Bubble, CategoryBadge, Composer, Reactions, StatusBadge } from './parts';
import { NewIdeaDrawer } from './new-idea';

const PAGE = 6;

/** One idea: the post, the latest contributions under it, and the full thread + composer when opened */
function Idea({ p, open, onToggle }: { p: FeedbackPost; open: boolean; onToggle: () => void }) {
  const { data: full, isLoading } = useQuery({
    queryKey: feedbackKeys.post(p.id),
    queryFn: () => api.get<FeedbackDetail>(`/feedback/${p.id}`),
    enabled: open,
  });
  const thread = open ? full?.comments : p.recent;
  const hidden = open ? 0 : Math.max(0, p.commentCount - (p.recent?.length ?? 0));

  return (
    <li id={`idea-${p.id}`} className={cn('card scroll-mt-24 p-4 transition-colors sm:p-5', open && 'border-line-strong')}>
      <div className="flex gap-4">
        <Avatar name={p.authorName} size="lg" />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onToggle} className="block w-full text-left" aria-expanded={open}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-bold">{p.title}</h3>
              {p.status !== 'OPEN' && <StatusBadge status={p.status} />}
            </div>
            <p className={cn('mt-1 text-[14.5px] whitespace-pre-line text-ink-soft', !open && 'line-clamp-2')}>{p.body}</p>
          </button>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
            <Reactions id={p.id} up={full?.voteCount ?? p.voteCount} down={full?.downCount ?? p.downCount} mine={full?.myVote ?? p.myVote} />
            <span>{formatRelative(p.createdAt)}</span>
            <CategoryBadge category={p.category} />
          </div>

          {/* Contributions — chat style, right under the idea */}
          {!!thread?.length && (
            <ul className="mt-4 space-y-2.5 border-l-2 border-line pl-3 sm:pl-4">
              {thread.map((c) => (
                <Bubble key={c.id} c={c} />
              ))}
            </ul>
          )}
          {open && isLoading && (
            <div className="mt-4 flex justify-center">
              <Spinner className="size-5" />
            </div>
          )}

          <div className="mt-3">
            {open ? (
              <div className="space-y-3">
                <Composer postId={p.id} autoFocus={!p.commentCount} />
                <button type="button" onClick={onToggle} className="text-[13px] font-bold text-muted hover:text-ink">
                  Close
                </button>
              </div>
            ) : (
              <button type="button" onClick={onToggle} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline">
                <MessageSquare className="size-4" />
                {hidden > 0 ? `View all ${p.commentCount} · add yours` : 'Add to this idea'}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** Landing page feedback board — everything happens here: vote, read, contribute, share new ideas */
/** embedded: inside the signed-in app (no landing-page framing; the page header comes from the app) */
export function FeedbackSection({ embedded }: { embedded?: boolean } = {}) {
  const [drawer, setDrawer] = useState(false);
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [size, setSize] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = { sort, page: 1, pageSize: size };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: feedbackKeys.list(q),
    queryFn: () => api.page<FeedbackPage>('/feedback', q),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const ideas = data?.data ?? [];
  const more = (data?.meta.total ?? 0) > ideas.length;

  // arriving at /#feedback (e.g. from the account menu): scroll here once the ideas have loaded
  const loaded = !!data;
  useEffect(() => {
    if (loaded && !embedded && window.location.hash === '#feedback') {
      setTimeout(() => document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, [loaded, embedded]);

  // a new idea (from here or the side tab) → show newest first and open it
  useEffect(() => {
    const onCreated = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setSize(PAGE);
      setSort('new');
      setOpenId(id);
      setTimeout(() => document.getElementById(`idea-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 600);
    };
    window.addEventListener('feedback:created', onCreated);
    return () => window.removeEventListener('feedback:created', onCreated);
  }, []);

  return (
    <section id="feedback" className={cn('scroll-mt-20', !embedded && 'border-t border-line')}>
      <div className={cn('mx-auto max-w-[860px]', embedded ? 'pb-8' : 'px-4 py-16 sm:px-6')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[13px] font-bold tracking-wide text-primary uppercase">
              <Lightbulb className="size-4" /> {embedded ? 'Feedback' : 'Built with our users'}
            </div>
            <h2 className={cn('mt-1 font-extrabold tracking-[-0.02em]', embedded ? 'page-title' : 'text-[28px]')}>{embedded ? 'Ideas & feedback' : 'What people are asking for'}</h2>
            <p className="mt-1 text-[15px] text-muted">Like the ideas you want next, add your thoughts, or suggest your own.</p>
          </div>
          <Button icon={<Plus className="size-4" strokeWidth={2.5} />} onClick={() => setDrawer(true)} className="shrink-0">
            Share an idea
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Segmented<'top' | 'new'>
            value={sort}
            onChange={(v) => {
              setSort(v);
              setSize(PAGE);
            }}
            options={[
              { value: 'top', label: 'Most voted' },
              { value: 'new', label: 'Newest' },
            ]}
          />
          {data && <span className="text-[13px] text-muted">{data.meta.total} ideas</span>}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : (
          <ul className={cn('mt-4 space-y-3 transition-opacity', isFetching && 'opacity-80')}>
            {ideas.map((p) => (
              <Idea key={p.id} p={p} open={openId === p.id} onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))} />
            ))}
          </ul>
        )}

        {more && (
          <div className="mt-5 flex justify-center">
            <Button variant="secondary" icon={<ChevronDown className="size-4" />} onClick={() => setSize((s) => s + PAGE)} loading={isFetching && !isLoading}>
              Show more ideas
            </Button>
          </div>
        )}
      </div>
      <NewIdeaDrawer open={drawer} onClose={() => setDrawer(false)} />
    </section>
  );
}
