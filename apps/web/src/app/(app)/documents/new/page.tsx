'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { NewDocument } from '@/components/editor/business-editor';
import type { DocType } from '@/lib/types';

function Page() {
  const t = useSearchParams().get('type');
  const type = (['INVOICE', 'QUOTE', 'RECEIPT'].includes(t ?? '') ? t : 'INVOICE') as DocType;
  return <NewDocument type={type} />;
}

export default function NewDocumentPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
