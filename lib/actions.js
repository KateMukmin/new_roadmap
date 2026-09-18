'use server';

import { prisma } from './prisma';
import { revalidatePath } from 'next/cache';
import { ACCENTS } from './roadmapUtils';

function refresh() {
  revalidatePath('/');
}

export async function updateTitle(title) {
  const clean = (title || '').trim() || 'New Roadmap';
  await prisma.setting.upsert({
    where: { id: 'singleton' },
    update: { title: clean },
    create: { id: 'singleton', title: clean },
  });
  refresh();
}

export async function createTheme(name) {
  const clean = (name || '').trim();
  if (!clean) return null;
  const count = await prisma.theme.count();
  const theme = await prisma.theme.create({
    data: { name: clean, color: ACCENTS[count % ACCENTS.length], position: count },
  });
  refresh();
  return { id: theme.id, name: theme.name, color: theme.color, position: theme.position };
}

export async function renameTheme(id, name) {
  const clean = (name || '').trim() || 'Untitled theme';
  await prisma.theme.update({ where: { id }, data: { name: clean } });
  refresh();
}

// Items keep any of their other theme tags; only the link to this theme
// is removed (Prisma's onDelete: Cascade on ThemeItem handles that).
export async function deleteTheme(id) {
  await prisma.theme.delete({ where: { id } });
  refresh();
}

export async function reorderThemes(orderedIds) {
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.theme.update({ where: { id }, data: { position: index } }))
  );
  refresh();
}

// Cleans a list of {label, when} phase rows: drops empty labels, trims
// text, and assigns position from array order.
function cleanPhases(phases) {
  return (phases || [])
    .map((p, i) => ({ label: (p.label || '').trim(), when: (p.when || '').trim() || null, position: i }))
    .filter((p) => p.label);
}

export async function createItem(input) {
  const title = (input.title || '').trim();
  if (!title) return;

  const themeIds = input.themeIds || [];
  const links = [];
  for (const themeId of themeIds) {
    const count = await prisma.themeItem.count({ where: { themeId } });
    links.push({ themeId, position: count });
  }
  const phases = cleanPhases(input.phases);

  await prisma.item.create({
    data: {
      title,
      description: (input.description || '').trim() || null,
      status: (input.status || 'now').toUpperCase(),
      when: (input.when || '').trim() || null,
      themes: { create: links },
      phases: { create: phases },
    },
  });
  refresh();
}

export async function updateItem(id, input) {
  const title = (input.title || '').trim();
  if (!title) return;

  const themeIds = input.themeIds || [];
  const existingLinks = await prisma.themeItem.findMany({ where: { itemId: id } });
  const existingThemeIds = existingLinks.map((l) => l.themeId);

  const toRemove = existingThemeIds.filter((tid) => !themeIds.includes(tid));
  const toAdd = themeIds.filter((tid) => !existingThemeIds.includes(tid));
  const phases = cleanPhases(input.phases);

  await prisma.$transaction(async (tx) => {
    await tx.item.update({
      where: { id },
      data: {
        title,
        description: (input.description || '').trim() || null,
        status: (input.status || 'now').toUpperCase(),
        when: (input.when || '').trim() || null,
      },
    });

    if (toRemove.length) {
      await tx.themeItem.deleteMany({ where: { itemId: id, themeId: { in: toRemove } } });
    }

    for (const themeId of toAdd) {
      const count = await tx.themeItem.count({ where: { themeId } });
      await tx.themeItem.create({ data: { themeId, itemId: id, position: count } });
    }

    // Phases have no stable identity worth diffing across edits, simplest
    // and correct: replace the whole set with whatever was just submitted.
    await tx.phase.deleteMany({ where: { itemId: id } });
    if (phases.length) {
      await tx.phase.createMany({ data: phases.map((p) => ({ ...p, itemId: id })) });
    }
  });
  refresh();
}

export async function deleteItem(id) {
  await prisma.item.delete({ where: { id } });
  refresh();
}

// Persists a new manual order for one theme's items (used by the
// up/down reorder controls, only relevant when sorting by Status).
export async function reorderThemeItems(themeId, orderedItemIds) {
  await prisma.$transaction(
    orderedItemIds.map((itemId, index) =>
      prisma.themeItem.update({
        where: { themeId_itemId: { themeId, itemId } },
        data: { position: index },
      })
    )
  );
  refresh();
}
