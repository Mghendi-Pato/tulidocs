'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';
import { CATEGORY_OPTIONS, FeedbackCategory, FeedbackDetail } from '@/lib/feedback';
import { useMe } from '@/lib/queries';

/** boardLink: show a link to the public board (when opened from the side tab) */
export function NewIdeaDrawer({ open, onClose, boardLink, onCreated }: { open: boolean; onClose: () => void; boardLink?: boolean; onCreated?: (p: FeedbackDetail) => void }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [f, setF] = useState({ title: '', body: '', category: 'FEATURE' as FeedbackCategory, name: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // the button stays off until the title and details are long enough
  const valid = f.title.trim().length >= 6 && f.body.trim().length >= 10;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (f.title.trim().length < 6) e.title = 'Give it a short title (at least 6 characters)';
    if (f.body.trim().length < 10) e.body = 'Tell us a little more (at least 10 characters)';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const { name, website, ...rest } = f;
      const post = await api.post<FeedbackDetail>('/feedback', me ? rest : { ...rest, name: name || undefined, website: website || undefined });
      void qc.invalidateQueries({ queryKey: ['feedback'] });
      const isPrivate = f.category === 'PRIVATE';
      toast.success(isPrivate ? 'Sent privately to the tuli team' : 'Thanks — your idea is on the board');
      setF({ title: '', body: '', category: 'FEATURE', name: '', website: '' });
      onClose();
      if (!isPrivate) {
        onCreated?.(post);
        // lets the landing-page section show and open the new idea
        window.dispatchEvent(new CustomEvent('feedback:created', { detail: post.id }));
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Share an idea"
      description={f.category === 'PRIVATE' ? 'Send a private message to the tuli team — only we can read it.' : 'Suggest a feature, an improvement, or report something that isn’t working. Everyone can see and like it.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!valid} icon={<Send className="size-4" />}>
            {f.category === 'PRIVATE' ? 'Send privately' : 'Post idea'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required error={errors.title} hint={f.title.trim().length < 6 ? 'At least 6 characters' : undefined}>
          {(id) => <Input id={id} value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Send invoices by WhatsApp" aria-invalid={!!errors.title} />}
        </Field>
        <Field label="Type" hint={f.category === 'PRIVATE' ? 'Goes straight to the tuli team — it won’t appear on the public board.' : undefined}>
          {(id) => (
            <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as FeedbackCategory })}>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Details" required error={errors.body} hint={f.body.trim().length < 10 ? 'At least 10 characters — what would it help you do? For bugs: what happened, and what you expected.' : 'What would it help you do? For bugs: what happened, and what you expected.'}>
          {(id) => <Textarea id={id} rows={6} maxLength={4000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} aria-invalid={!!errors.body} />}
        </Field>
        {!me && (
          <>
            <Field label="Your name" optional hint="Only your initials are shown. Leave empty to stay anonymous.">
              {(id) => <Input id={id} value={f.name} maxLength={60} autoComplete="name" onChange={(e) => setF({ ...f, name: e.target.value })} />}
            </Field>
            {/* spam trap: hidden from people, bots fill it in */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
          </>
        )}
        {boardLink && (
          <p className="text-[13px] text-muted">
            Want to see what others asked for?{' '}
            <Link href="/#feedback" className="link" onClick={onClose}>
              See ideas and vote
            </Link>
          </p>
        )}
      </div>
    </Drawer>
  );
}
