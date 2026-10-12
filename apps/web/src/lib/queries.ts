'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { COUNTRIES, countryOptions, detectCountry } from './countries';
import { api } from './api';
import type { BillingOverview, Client, Doc, Me, Organization, Pricing } from './types';

export const keys = {
  me: ['me'] as const,
  org: ['organization'] as const,
  config: ['auth-config'] as const,
  pricing: ['pricing'] as const,
  billing: ['billing'] as const,
  summary: ['summary'] as const,
  docs: (q: object) => ['documents', q] as const,
  doc: (id: string) => ['document', id] as const,
  clients: (q: object) => ['clients', q] as const,
  guestDocs: ['guest-docs'] as const,
  guestDoc: (id: string) => ['guest-doc', id] as const,
};

/** The signed-in account, or null when signed out (never redirects). */
export function useMe(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api.get<Me>('/auth/me').catch(() => null),
    staleTime: 60_000,
    enabled: opts.enabled ?? true,
  });
}

export function useAuthConfig() {
  return useQuery({
    queryKey: keys.config,
    queryFn: () => api.get<{ platformName: string; googleEnabled: boolean; appleEnabled?: boolean; signupEnabled: boolean }>('/auth/config'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Regional prices for the visitor (browser-detected country; the server prefers Cloudflare's country) */
export function usePricing() {
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => setCountry(detectCountry()), []);
  return useQuery({
    queryKey: [...keys.pricing, country],
    queryFn: () => api.get<Pricing>('/billing/pricing', { country: country === 'XX' ? undefined : country }),
    staleTime: 10 * 60_000,
    enabled: country !== null,
  });
}

export function useOrganization() {
  return useQuery({ queryKey: keys.org, queryFn: () => api.get<Organization>('/organization') });
}

export function useDoc(id: string | null) {
  return useQuery({ queryKey: keys.doc(id ?? ''), queryFn: () => api.get<Doc>(`/documents/${id}`), enabled: !!id });
}

export function useClients(search: string) {
  return useQuery({
    queryKey: keys.clients({ search }),
    queryFn: () => api.page<{ data: Client[] }>('/clients', { search, pageSize: 50 }),
    staleTime: 30_000,
  });
}

/** The signed-in business's plan + prices in its own region */
export function useBilling() {
  return useQuery({ queryKey: keys.billing, queryFn: () => api.get<BillingOverview>('/billing') });
}

/** A document made without an account on this device (newest first) */
export type GuestDocRow = { id: string; type: string; number: string; clientName: string; total: string; currency: string; issueDate: string; unlocked: boolean };

/** Documents made on this device without an account (empty when signed in). */
export function useGuestDocs(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.guestDocs,
    queryFn: () => api.get<GuestDocRow[]>('/guest/documents').catch(() => [] as GuestDocRow[]),
    staleTime: 30_000,
    enabled: opts.enabled ?? true,
  });
}

/**
 * Where the visitor is: the country seen by the server (Cloudflare IP header) when known,
 * otherwise the browser's time zone. 'XX' while unknown.
 */
export function useLocalCountry(): string {
  const { data: pricing } = usePricing();
  const [tz, setTz] = useState('XX');
  useEffect(() => setTz(detectCountry()), []);
  const ip = pricing?.country?.toUpperCase();
  return ip && COUNTRIES.some((c) => c.code === ip) ? ip : tz;
}

/** Country dropdown options with the visitor's own country first. */
export function useCountryOptions() {
  return countryOptions(useLocalCountry());
}
