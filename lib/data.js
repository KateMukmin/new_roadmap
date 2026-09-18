import { prisma } from './prisma';

// Fetches everything the roadmap UI needs and shapes it into plain,
// UI-friendly objects (lowercase status, flat theme-link list, etc).
export async function getRoadmapData() {
  const [themes, items, setting] = await Promise.all([
    prisma.theme.findMany({ orderBy: { position: 'asc' } }),
    prisma.item.findMany({
      include: { themes: true, phases: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.setting.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton', title: 'New Roadmap' },
    }),
  ]);

  const shapedItems = items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? '',
    status: item.status.toLowerCase(),
    when: item.when ?? '',
    themeLinks: item.themes.map((t) => ({ themeId: t.themeId, position: t.position })),
    phases: item.phases.map((p) => ({ id: p.id, label: p.label, when: p.when ?? '' })),
  }));

  return {
    title: setting.title,
    themes: themes.map((t) => ({ id: t.id, name: t.name, color: t.color, position: t.position })),
    items: shapedItems,
  };
}
