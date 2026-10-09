'use client';

import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { useClients } from '@/lib/queries';
import type { Client } from '@/lib/types';

/**
 * Client name with suggestions from the client list (Material UI Autocomplete).
 * Typing a new name is fine — the client is saved automatically with the document.
 */
export function ClientPicker({
  id,
  value,
  onText,
  onPick,
  invalid,
}: {
  id?: string;
  value: string;
  onText: (name: string) => void;
  onPick: (c: Client) => void;
  invalid?: boolean;
}) {
  const [search, setSearch] = useState('');
  const { data, isFetching } = useClients(search);
  const options = data?.data ?? [];

  return (
    <Autocomplete<Client, false, false, true>
      id={id}
      freeSolo
      options={options}
      loading={isFetching}
      filterOptions={(x) => x}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
      inputValue={value}
      onInputChange={(_, v, reason) => {
        if (reason === 'reset') return;
        onText(v);
        setSearch(v);
      }}
      onChange={(_, v) => {
        if (v && typeof v !== 'string') onPick(v);
      }}
      renderOption={(props, o) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <li key={key} {...rest}>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-ink">{o.name}</span>
              {(o.email || o.phone) && <span className="block truncate text-[12.5px] text-muted">{[o.email, o.phone].filter(Boolean).join(' · ')}</span>}
            </span>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField {...params} placeholder="Client or company name" error={invalid} sx={{ '& .MuiInputBase-root': { minHeight: 48, fontSize: 15, py: '2px' } }} />
      )}
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    />
  );
}
