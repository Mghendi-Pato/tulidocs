'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Lightbulb, MessageSquare, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Avatar, CategoryBadge, Reactions, StatusBadge } from '@/components/feedback/parts';
import { NewIdeaDrawer } from '@/components/feedback/new-idea';
import { PublicFooter, PublicHeader } from '@/components/layout/public-header';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { EmptyState, ErrorState, Pagination, Segmented } from '@/components/ui/misc';
import { Spinner } from '@/components/ui/spinner';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { formatRelative } from '@/lib/format';
import { CATEGORY_LABEL, FeedbackCategory, feedbackKeys, FeedbackStatus, STATUS_LABEL } from '@/lib/feedback';
import type { FeedbackPage as FeedbackList } from '@/lib/feedback';

const TABS: { value: '' | FeedbackStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
];

function Board() {
  const router = useRouter();
  const params = useSearchParams();
  const status = (params.get('status') ?? '') as '' | FeedbackStatus;
  const sort = params.get('sort') === 'new' ? 'new' : 'top';
  const category = (params.get('category') ?? '') as '' | FeedbackCategory;
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(search);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  // ?new=1 (e.g. back from sign-in) opens the form
  useEffect(() => {
    if (params.get('new') === '1') setOpen(true);
  }, [params]);

  const go = (patch: Record<string, string | number | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, String(v));
    }
    router.replace(`/feedback/${p.toString() ? `?${p}` : ''}`, { scroll: false });
  };

  const q = { status, sort, category, page, search: debounced };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: feedbackKeys.list(q),
    queryFn: () => api.page<FeedbackList>('/feedback', { ...q, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const counts = data?.meta.statusCounts ?? {};
  const total = (['OPEN', 'PLANNED', 'IN_PROGRESS', 'DONE'] as FeedbackStatus[]).reduce((n, s) => n + (counts[s] ?? 0), 0);
  const share = () => setOpen(true);
  const { data: me } = useMe();
  const admin = me?.role === 'SYSTEM_ADMIN';

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicHeader />

      <section className="border-b border-line bg-sidebar">
        <div className="mx-auto flex max-w-[960px] flex-col gap-5 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[13px] font-bold tracking-wide text-primary uppercase">
              <Lightbulb className="size-4" /> Feedback board
            </div>
            <h1 className="font-display mt-2 text-[34px] leading-tight font-bold tracking-[-0.02em] sm:text-[40px]">Help shape tuli</h1>
            <p className="mt-2 max-w-[560px] text-[16px] text-ink-soft">Suggest features, report bugs and vote for the ideas you want most. We read everything and update the status as we go.</p>
          </div>
          <Button size="lg" icon={<Plus className="size-[18px]" strokeWidth={2.5} />} onClick={share} className="shrink-0">
            Share an idea
          </Button>
        </div>
      </section>

      <main className="mx-auto max-w-[960px] px-4 py-8 sm:px-6">
        <div className="mb-5 flex flex-col gap-3">
          <Segmented<'' | FeedbackStatus>
            value={status}
            onChange={(v) => go({ status: v, page: null })}
            options={TABS.map((t) => ({ value: t.value, label: `${t.label}${data ? ` · ${t.value ? (counts[t.value] ?? 0) : total}` : ''}` }))}
            className="self-start"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (page !== 1) go({ page: null });
                }}
                placeholder="Search ideas"
                className="h-11 pl-11"
                aria-label="Search ideas"
              />
            </div>
            <div className="sm:w-52">
              <Select value={category} onChange={(e) => go({ category: e.target.value, page: null })} aria-label="Type" className="h-11">
                <option value="">All types</option>
                {Object.entries(CATEGORY_LABEL)
                  .filter(([k]) => k !== 'PRIVATE' || admin)
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </Select>
            </div>
            <Segmented<'top' | 'new'>
              value={sort}
              onChange={(v) => go({ sort: v === 'top' ? null : v, page: null })}
              options={[
                { value: 'top', label: 'Top' },
                { value: 'new', label: 'Newest' },
              ]}
              className="shrink-0 self-start sm:self-auto"
            />
          </div>
        </div>

        {error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-7" />
          </div>
        ) : !data?.data.length ? (
          <div className="card">
            <EmptyState
              icon={<Lightbulb className="size-6" />}
              title={debounced || category || status ? 'Nothing matches' : 'No ideas yet'}
              body={debounced || category || status ? 'Try a different search or filter — or share it as a new idea.' : 'Be the first to suggest something.'}
              action={<Button onClick={share}>Share an idea</Button>}
            />
          </div>
        ) : (
          <ul className={`space-y-3 transition-opacity ${isFetching ? 'opacity-70' : ''}`}>
            {data.data.map((p) => (
              <li key={p.id}>
                <Link href={`/feedback/post/?id=${p.id}`} className="card flex gap-4 p-4 transition-colors hover:border-line-strong sm:p-5">
                  <Avatar name={p.authorName} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-bold">{p.title}</h2>
                      {p.status !== 'OPEN' && <StatusBadge status={p.status} />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[14.5px] text-ink-soft">{p.body}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
                      <Reactions id={p.id} up={p.voteCount} down={p.downCount} mine={p.myVote} />
                      <CategoryBadge category={p.category} />
                      <span>{formatRelative(p.createdAt)}</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3.5" /> {p.commentCount}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data?.meta && <Pagination page={data.meta.page} pageCount={data.meta.pageCount} onPage={(n) => go({ page: n })} />}
        <p className="mt-8 text-center text-[13px] text-muted">
          Ideas marked “{STATUS_LABEL.DECLINED}” are hidden from the board.{' '}
          <button type="button" className="link" onClick={() => go({ status: 'DECLINED', page: null })}>
            Show them
          </button>
        </p>
      </main>

      <PublicFooter />
      <NewIdeaDrawer open={open} onClose={() => { setOpen(false); if (params.get('new')) go({ new: null }); }} />
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense>
      <Board />
    </Suspense>
  );
}
