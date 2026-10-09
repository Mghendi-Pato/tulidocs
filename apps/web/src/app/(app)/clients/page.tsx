'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, IconButton } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Drawer } from '@/components/ui/drawer';
import { Field, Input, Textarea } from '@/components/ui/field';
import { EmptyState, ErrorState, PageHeader, Pagination } from '@/components/ui/misc';
import { DataTable } from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import type { Client, Paged } from '@/lib/types';

const EMPTY = { name: '', email: '', phone: '', address: '', taxId: '' };

function ClientDrawer({ client, open, onClose }: { client: Client | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const taxIdLabel = useAuth().organization.taxIdLabel;
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setErr(null);
      setF(client ? { name: client.name, email: client.email ?? '', phone: client.phone ?? '', address: client.address ?? '', taxId: client.taxId ?? '' } : EMPTY);
    }
  }, [open, client]);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  // the button stays off until the name is filled in (and any email looks right); editing also needs a change
  const emailOk = !f.email.trim() || /^\S+@\S+\.\S+$/.test(f.email.trim());
  const changed = !client || (Object.keys(EMPTY) as (keyof typeof EMPTY)[]).some((k) => f[k] !== (k === 'name' ? client.name : ((client[k] as string | null) ?? '')));
  const valid = f.name.trim().length > 0 && emailOk && changed;

  const save = async () => {
    if (!f.name.trim()) return setErr('Enter the client’s name');
    setBusy(true);
    try {
      if (client) await api.patch(`/clients/${client.id}`, f);
      else await api.post('/clients', f);
      void qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(client ? 'Client updated' : 'Client added');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={client ? 'Edit client' : 'New client'}
      description={client ? 'Documents you already issued keep the details they were sent with.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={busy} disabled={!valid}>
            {client ? 'Save' : 'Add client'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={err ?? undefined} className="sm:col-span-2">
          {(id) => <Input id={id} value={f.name} onChange={set('name')} aria-invalid={!!err} />}
        </Field>
        <Field label="Email" optional error={emailOk ? undefined : 'Enter a valid email address'}>
          {(id) => <Input id={id} type="email" value={f.email} onChange={set('email')} aria-invalid={!emailOk} />}
        </Field>
        <Field label="Phone" optional>{(id) => <Input id={id} inputMode="tel" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label={taxIdLabel} optional>{(id) => <Input id={id} value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value.toUpperCase() })} />}</Field>
        <Field label="Address" optional className="sm:col-span-2">{(id) => <Textarea id={id} rows={2} value={f.address} onChange={set('address')} />}</Field>
      </div>
    </Drawer>
  );
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const { organization: org } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['clients', { list: true, search: debounced, page }],
    queryFn: () => api.page<Paged<Client>>('/clients', { search: debounced, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  const remove = (c: Client) =>
    confirm({
      title: `Delete ${c.name}?`,
      body: 'Documents already issued to this client are kept as they are.',
      confirmLabel: 'Delete',
      tone: 'danger',
      action: async () => {
        try {
          await api.delete(`/clients/${c.id}`);
          void qc.invalidateQueries({ queryKey: ['clients'] });
          toast.success('Client deleted');
        } catch (e) {
          toast.error(errorMessage(e));
          throw e;
        }
      },
    });

  const edit = (c: Client | null) => {
    setEditing(c);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Clients"
        description="Saved automatically when you create documents — or add them here."
        actions={
          <Button icon={<Plus className="size-4" strokeWidth={2.5} />} onClick={() => edit(null)}>
            New client
          </Button>
        }
      />
      <div className="relative mb-5 sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" className="h-11 pl-11" aria-label="Search clients" />
      </div>
      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable<Client>
            rows={data?.data}
            loading={isLoading || isFetching}
            rowKey={(c) => c.id}
            columns={[
              { key: 'name', header: 'Name', cell: (c) => <span className="font-bold">{c.name}</span> },
              { key: 'contact', header: 'Contact', cell: (c) => <span className="text-muted">{[c.email, c.phone].filter(Boolean).join(' · ') || '—'}</span>, hideBelow: 'lg' },
              { key: 'pin', header: org.taxIdLabel, cell: (c) => c.taxId ?? '—', hideBelow: 'xl' },
              {
                key: 'owed',
                header: 'Owes you',
                align: 'right',
                cell: (c) =>
                  Number(c.outstanding) > 0 ? (
                    <Link href={`/documents/?type=INVOICE&status=UNPAID&range=custom&q=${encodeURIComponent(c.name)}`} className="font-bold tabular hover:underline">
                      {formatMoney(c.outstanding, org.currency)}
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                cell: (c) => (
                  <span className="inline-flex gap-1">
                    <IconButton label="Edit client" onClick={() => edit(c)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton label="Delete client" onClick={() => void remove(c)}>
                      <Trash2 className="size-4 text-muted" />
                    </IconButton>
                  </span>
                ),
              },
            ]}
            mobile={(c) => (
              <div className="flex items-center justify-between gap-3">
                <button type="button" className="min-w-0 text-left" onClick={() => edit(c)}>
                  <span className="block truncate text-[15px] font-bold">{c.name}</span>
                  <span className="block truncate text-[13px] text-muted">{[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details'}</span>
                </button>
                {Number(c.outstanding) > 0 && <span className="text-sm font-bold tabular">{formatMoney(c.outstanding, org.currency)}</span>}
              </div>
            )}
            empty={
              <div className="card">
                <EmptyState icon={<Users className="size-6" />} title={debounced ? 'No clients match' : 'No clients yet'} body={debounced ? undefined : 'They’re added automatically the first time you bill someone.'} />
              </div>
            }
          />
          {data?.meta && <Pagination page={data.meta.page} pageCount={data.meta.pageCount} onPage={setPage} />}
        </>
      )}
      <ClientDrawer client={editing} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
