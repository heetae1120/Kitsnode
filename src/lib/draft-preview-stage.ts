"use client";
import { useSyncExternalStore } from 'react';
import { validPreviewStage } from './layout-preview';
let current: { page: string; stage: string } | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
/** Called only by the verified bridge. In-memory state, never URL/storage/form data. */
export function setDraftPreviewStage(page: string, stage?: string) {
  current = stage && validPreviewStage(page, stage) ? { page, stage } : null;
  listeners.forEach(listener => listener());
}
export function useDraftPreviewStage(page: string): string | null {
  return useSyncExternalStore(subscribe, () => current?.page === page ? current.stage : null, () => null);
}
export function isDraftPreviewMode() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('kits_preview');
}
