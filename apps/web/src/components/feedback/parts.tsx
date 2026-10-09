'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Lock, Send, ThumbsDown, ThumbsUp, Trash2, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { CATEGORY_LABEL, FeedbackCategory, FeedbackComment, FeedbackDetail, feedbackKeys, FeedbackStatus, STATUS_LABEL, STATUS_TONE } from '@/lib/feedback';
import { useMe } from '@/lib/queries';

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold', STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

export function CategoryBadge({ category }: { category: FeedbackCategory }) {
  if (category === 'PRIVATE')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-[12px] font-semibold text-white">
        <Lock className="size-3" /> Private
      </span>
    );
  return <span className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-[12px] font-semibold text-muted">{CATEGORY_LABEL[category]}</span>;
}

const AVATAR_TONES = ['bg-[#2451d6]', 'bg-[#0d9488]', 'bg-[#d97706]', 'bg-[#7c3aed]', 'bg-[#db2777]', 'bg-[#16a34a]', 'bg-[#0891b2]', 'bg-[#c8102e]'];

/** Coloured initials — the colour is stable per name; the team gets the brand mark */
export function Avatar({ name, team, size = 'md', className }: { name: string; team?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const person = name.split('·')[0].trim() || 'Anonymous';
  const anonymous = !team && ['anonymous', 'guest'].includes(person.toLowerCase());
  const initials = person.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const tone = AVATAR_TONES[[...person].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TONES.length];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-canvas',
        size === 'sm' ? 'size-7 text-[11px]' : size === 'lg' ? 'size-12 text-[16px]' : 'size-9 text-[13px]',
        team ? 'bg-ink' : anonymous ? 'bg-subtle' : tone,
        className,
      )}
    >
      {team ? 't' : anonymous ? <User className={size === 'lg' ? 'size-6' : 'size-4'} /> : initials}
      {team && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-canvas bg-brand" />}
    </span>
  );
}

/** Like / dislike — optimistic; one reaction per account (or browser). Voting the other way switches it. */
export function Reactions({ id, up, down, mine }: { id: string; up: number; down: number; mine: number }) {
  const qc = useQueryClient();
  const [state, setState] = useState({ up, down, mine });
  const [busy, setBusy] = useState(false);
  // refs block a second click straight away (before React re-renders), e.g. a quick double-click
  const lock = useRef(false);
  const current = useRef(mine);
  current.current = state.mine;
  // follow fresh server data when it changes (never while a vote is being saved)
  const [seen, setSeen] = useState({ up, down, mine });
  if (!busy && (seen.up !== up || seen.down !== down || seen.mine !== mine)) {
    setSeen({ up, down, mine });
    setState({ up, down, mine });
  }

  const react = async (value: 1 | -1, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // once you've voted a way, that button is off — only the other one can switch your vote
    if (lock.current || current.current === value) return;
    lock.current = true;
    current.current = value;
    const prev = state;
    // optimistic: a like cancels a dislike and vice versa
    const next = { ...prev, mine: value };
    if (prev.mine === 1) next.up--;
    if (prev.mine === -1) next.down--;
    if (value === 1) next.up++;
    else next.down++;
    setState(next);
    setBusy(true);
    try {
      const r = await api.post<{ myVote: number; voteCount: number; downCount: number }>(`/feedback/${id}/vote`, { value });
      setState({ up: r.voteCount, down: r.downCount, mine: r.myVote || value });
      void qc.invalidateQueries({ queryKey: ['feedback'] });
      void qc.invalidateQueries({ queryKey: ['feedback-post', id] });
    } catch (err) {
      setState(prev);
      current.current = prev.mine;
      toast.error(errorMessage(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const liked = state.mine === 1;
  const disliked = state.mine === -1;
  // plain icons: the one you chose turns coloured + filled and can't be pressed again; the other stays clickable to switch
  const btn = (on: boolean, tone: string) =>
    cn('inline-flex items-center gap-1 text-[13px] font-bold tabular transition-colors', on ? cn(tone, 'pointer-events-none cursor-not-allowed') : 'text-muted hover:text-ink');

  return (
    <div className="inline-flex items-center gap-3.5">
      <button
        type="button"
        onClick={(e) => void react(1, e)}
        disabled={liked || busy}
        aria-pressed={liked}
        aria-label={liked ? `You liked this (${state.up})` : `Like (${state.up})`}
        title={liked ? 'You liked this' : 'Like'}
        className={btn(liked, 'text-primary')}
      >
        <ThumbsUp className="size-[17px]" strokeWidth={2.2} fill={liked ? 'currentColor' : 'none'} fillOpacity={liked ? 0.18 : 0} /> {state.up}
      </button>
      <button
        type="button"
        onClick={(e) => void react(-1, e)}
        disabled={disliked || busy}
        aria-pressed={disliked}
        aria-label={disliked ? `You disliked this (${state.down})` : `Dislike (${state.down})`}
        title={disliked ? 'You disliked this' : 'Dislike'}
        className={btn(disliked, 'text-ink')}
      >
        <ThumbsDown className="size-[17px]" strokeWidth={2.2} fill={disliked ? 'currentColor' : 'none'} fillOpacity={disliked ? 0.18 : 0} /> {state.down}
      </button>
    </div>
  );
}

/** One contribution as a chat bubble */
export function Bubble({ c, onDelete }: { c: Pick<FeedbackComment, 'authorName' | 'isTeam' | 'body' | 'createdAt'>; onDelete?: () => void }) {
  return (
    <li className="flex gap-3">
      <Avatar name={c.authorName} team={c.isTeam} size="sm" className="mt-0.5" />
      <div className={cn('min-w-0 flex-1 rounded-2xl rounded-tl-md px-3.5 py-2.5', c.isTeam ? 'bg-primary-soft' : 'bg-panel')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-[12.5px]">
            <span className="truncate font-bold">{c.authorName}</span>
            {c.isTeam && <span className="rounded-full bg-primary px-1.5 py-px text-[10.5px] font-bold text-white">Team</span>}
            <span className="text-muted">{formatRelative(c.createdAt)}</span>
          </div>
          {onDelete && (
            <button type="button" onClick={onDelete} className="text-muted hover:text-danger" aria-label="Delete">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        <p className="mt-0.5 text-[14.5px] leading-relaxed whitespace-pre-line">{c.body}</p>
      </div>
    </li>
  );
}

/** "Add to this idea" composer — open to everyone (visitors can give a name) */
export function Composer({ postId, autoFocus, onPosted }: { postId: string; autoFocus?: boolean; onPosted?: (p: FeedbackDetail) => void }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const admin = me?.role === 'SYSTEM_ADMIN';

  const send = async () => {
    if (body.trim().length < 2) return;
    setBusy(true);
    try {
      const p = await api.post<FeedbackDetail>(`/feedback/${postId}/comments`, me ? { body } : { body, name: name || undefined, website: website || undefined });
      qc.setQueryData(feedbackKeys.post(postId), p);
      void qc.invalidateQueries({ queryKey: ['feedback'] });
      setBody('');
      onPosted?.(p);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-3">
      {me ? <Avatar name={admin ? 'tuli team' : me.name} team={admin} size="sm" className="mt-1" /> : <Avatar name={name || 'Guest'} size="sm" className="mt-1" />}
      <div className="min-w-0 flex-1 space-y-2">
        <Textarea
          rows={2}
          value={body}
          maxLength={2000}
          autoFocus={autoFocus}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send();
          }}
          placeholder={admin ? 'Reply as the tuli team…' : 'Add to this idea — how would it help you?'}
          aria-label="Add to this idea"
          className="min-h-[72px] rounded-2xl"
        />
        {/* spam trap: hidden from people, bots fill it in */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {!me && <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" aria-label="Your name" className="h-10 sm:max-w-[220px]" />}
          <Button size="sm" onClick={() => void send()} loading={busy} disabled={body.trim().length < 2} icon={<Send className="size-4" />}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Sends visitors who aren't signed in to the login page, then back here */
export function useSignInGate() {
  const { data: me, isFetched } = useMe();
  const router = useRouter();
  return {
    me,
    ready: isFetched,
    /** true when signed in; otherwise goes to sign-in and comes back to `next` (default: this page) */
    gate: (nextPath?: string) => {
      if (me) return true;
      const next = encodeURIComponent(nextPath ?? window.location.pathname + window.location.search);
      router.push(`/login/?next=${next}`);
      return false;
    },
  };
}
