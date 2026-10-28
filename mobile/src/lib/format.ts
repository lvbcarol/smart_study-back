export const formatDate = (iso: string | null | undefined, lang: string): string =>
  iso ? new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) : '';
