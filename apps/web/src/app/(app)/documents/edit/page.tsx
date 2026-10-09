'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { EditDocument } from '@/components/editor/business-editor';
import { ErrorState } from '@/components/ui/misc';
import { PageLoader } from '@/components/ui/spinner';
import { errorMessage } from '@/lib/api';
import { useDoc } from '@/lib/queries';

function Page() {
  const id = useSearchParams().get('id');
  const { data, isLoading, error } = useDoc(id);
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={errorMessage(error ?? new Error('Document not found'))} />;
  if (data.status === 'VOID') return <ErrorState message="A void document can’t be edited." />;
  return <EditDocument key={data.id} doc={data} />;
}

export default function EditDocumentPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
