export function recipeSource(sourceUrl?: string | null): string {
  if (!sourceUrl) return 'Friyo';
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.toLowerCase();
    if (host === 'xiaohongshu.com' || host.endsWith('.xiaohongshu.com') || host === 'xhslink.com') return '小红书';
    if (host === 'themealdb.com' || host.endsWith('.themealdb.com')) return 'TheMealDB';
    return host.replace(/^www\./, '');
  } catch { return 'External recipe'; }
}
export function recipeSourceLink(sourceUrl?: string | null): string | undefined {
  try { const url = new URL(sourceUrl!); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined; } catch { return undefined; }
}
