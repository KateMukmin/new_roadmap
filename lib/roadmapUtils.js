// Shared, framework-free helpers for sorting and displaying roadmap items.
// Used by the client component; kept separate so the logic is easy to find.

export const ACCENTS = ['accent-1', 'accent-2', 'accent-3', 'accent-4', 'accent-5', 'accent-6'];

export const STATUS_LABEL = { now: 'Now', next: 'Next', later: 'Later' };

const STATUS_WEIGHT = { now: 0, next: 1, later: 2 };

export function sortByStatus(items) {
  return items
    .slice()
    .sort((a, b) => (STATUS_WEIGHT[a.status] ?? 0) - (STATUS_WEIGHT[b.status] ?? 0));
}

// Turns a free-text "when" field (a real date, or something like "Q3 2026")
// into a comparable timestamp. Unparseable/empty values sort to the end.
export function parseWhenValue(when) {
  if (!when) return Infinity;
  const s = when.trim();

  const qMatch = s.match(/Q([1-4])\D*(\d{4})/i);
  if (qMatch) {
    const q = parseInt(qMatch[1], 10);
    const y = parseInt(qMatch[2], 10);
    return new Date(y, (q - 1) * 3, 1).getTime();
  }

  const yMatch = s.match(/^(\d{4})$/);
  if (yMatch) return new Date(parseInt(yMatch[1], 10), 0, 1).getTime();

  const parsed = Date.parse(s);
  if (!isNaN(parsed)) return parsed;

  return Infinity;
}

export function getSortedItems(items, sortMode) {
  if (sortMode === 'title') {
    return items.slice().sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sortMode === 'date') {
    return items.slice().sort((a, b) => {
      const va = parseWhenValue(a.when);
      const vb = parseWhenValue(b.when);
      if (va !== vb) return va - vb;
      return a.title.localeCompare(b.title);
    });
  }
  return sortByStatus(items);
}

// An item's manual-order position within one specific theme (items can
// belong to several themes, each with its own independent ordering).
export function themePosition(item, themeId) {
  const link = item.themeLinks.find((l) => l.themeId === themeId);
  return link ? link.position : Infinity;
}

// Fixed hex values matching the CSS accent tokens, needed wherever a real
// color string is required (canvas/Chart.js can't resolve CSS variables).
export const ACCENT_HEX = {
  'accent-1': '#3B6E8F', 'accent-2': '#A85630', 'accent-3': '#57724F',
  'accent-4': '#6C4E72', 'accent-5': '#93712F', 'accent-6': '#4B5A6B',
};
export const UNTAGGED_HEX = '#9C948A';

// Groups a "when" value into a quarter label for the by-date pie chart.
export function dateBucketLabel(when) {
  if (!when || !when.trim()) return 'No target date';
  const s = when.trim();

  const qMatch = s.match(/Q([1-4])\D*(\d{4})/i);
  if (qMatch) return `Q${qMatch[1]} ${qMatch[2]}`;

  const yMatch = s.match(/^(\d{4})$/);
  if (yMatch) return yMatch[1];

  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  }

  return s;
}
