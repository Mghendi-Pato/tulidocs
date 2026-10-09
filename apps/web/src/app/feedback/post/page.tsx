'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, Bubble, CategoryBadge, Composer, Reactions, StatusBadge } from '@/components/feedback/parts';
import { useMe } from '@/lib/queries';
import { PublicFooter, PublicHeader } from '@/components/layout/public-header';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Select } from '@/components/ui/field';
import { ErrorState } from '@/components/ui/misc';
import { Spinner } from '@/components/ui/spinner';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { FeedbackDetail, feedbackKeys, FeedbackStatus, STATUS_LABEL } from '@/lib/feedback';

function Post() {
  const id = useSearchParams().get('id') ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: me } = useMe();
  const admin = me?.role === 'SYSTEM_ADMIN';
  const { data: post, isLoading, error } = useQuery({
    queryKey: feedbackKeys.post(id),
    queryFn: () => api.get<FeedbackDetail>(`/feedback/${id}`),
    enabled: !!id,
  });
  const [busy, setBusy] = useState<string | null>(null);

  const update = (p: FeedbackDetail) => {
    qc.setQueryData(feedbackKeys.post(id), p);
    void qc.invalidateQueries({ queryKey: ['feedback'] });
  };

  const setStatus = async (status: FeedbackStatus) => {
    setBusy('status');
    try {
      update(await api.patch<FeedbackDetail>(`/feedback/${id}/status`, { status }));
      toast.success(`Marked as ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const removePost = () =>
    confirm({
      title: 'Delete this idea?',
      body: 'Its votes and comments go too. This can’t be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
      action: async () => {
        try {
          await api.delete(`/feedback/${id}`);
          void qc.invalidateQueries({ queryKey: ['feedback'] });
          toast.success('Idea deleted');
          router.replace('/feedback/');
        } catch (e) {
          toast.error(errorMessage(e));
        }
      },
    });

  const removeComment = (cid: string) =>
    confirm({
      title: 'Delete this comment?',
      confirmLabel: 'Delete',
      tone: 'danger',
      action: async () => {
        try {
          update(await api.delete<FeedbackDetail>(`/feedback/${id}/comments/${cid}`));
        } catch (e) {
          toast.error(errorMessage(e));
        }
      },
    });

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicHeader />
      <main className="mx-auto max-w-[820px] px-4 py-8 sm:px-6">
        <Link href="/feedback/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Feedback board
        </Link>

        {error ? (
          <div className="mt-6">
            <ErrorState message={errorMessage(error)} />
          </div>
        ) : isLoading || !post ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-7" />
          </div>
        ) : (
          <>
            <article className="card mt-5 p-5 sm:p-7">
              <div className="flex gap-5">
                <Avatar name={post.authorName} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={post.status} />
                    <CategoryBadge category={post.category} />
                  </div>
                  <h1 className="mt-2 text-[24px] leading-tight font-extrabold tracking-[-0.02em]">{post.title}</h1>
                  <p className="mt-1 text-[13px] text-muted">{formatDate(post.createdAt)}</p>
                  <p className="mt-4 text-[15.5px] leading-relaxed whitespace-pre-line text-ink-soft">{post.body}</p>
                  {post.category !== 'PRIVATE' && (
                    <div className="mt-4">
                      <Reactions id={post.id} up={post.voteCount} down={post.downCount} mine={post.myVote} />
                    </div>
                  )}
                </div>
              </div>

              {(admin || post.mine) && (
                <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
                  {admin && (
                    <div className="w-48">
                      <Select value={post.status} onChange={(e) => void setStatus(e.target.value as FeedbackStatus)} aria-label="Status" disabled={busy === 'status'} className="h-10">
                        {Object.entries(STATUS_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => void removePost()} className="text-danger">
                    Delete
                  </Button>
                </div>
              )}
            </article>

            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-[17px] font-bold">
                <MessageSquare className="size-5 text-muted" /> {post.comments.length ? `${post.comments.length} comment${post.comments.length > 1 ? 's' : ''}` : 'Comments'}
              </h2>
              <ul className="mt-4 space-y-3">
                {post.comments.map((c) => (
                  <Bubble key={c.id} c={c} onDelete={admin || c.mine ? () => void removeComment(c.id) : undefined} />
                ))}
              </ul>
              <div className="card mt-4 p-4">
                <Composer postId={post.id} />
              </div>
            </section>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

export default function FeedbackPostPage() {
  return (
    <Suspense>
      <Post />
    </Suspense>
  );
}
