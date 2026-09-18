'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createItem,
  createTheme,
  deleteItem,
  deleteTheme,
  renameTheme,
  reorderThemeItems,
  reorderThemes,
  updateItem,
  updateTitle,
} from '@/lib/actions';
import { STATUS_LABEL, getSortedItems, themePosition } from '@/lib/roadmapUtils';

const SORT_OPTIONS = [
  { id: 'status', label: 'Status' },
  { id: 'title', label: 'Feature title' },
  { id: 'date', label: 'Delivery date' },
];

export default function RoadmapApp({ initialTitle, initialThemes, initialItems }) {
  const router = useRouter();

  // Server-backed state, kept in sync with the props Next.js re-sends
  // after every server action (see the effect below).
  const [title, setTitle] = useState(initialTitle);
  const [themes, setThemes] = useState(initialThemes);
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setTitle(initialTitle);
    setThemes(initialThemes);
    setItems(initialItems);
  }, [initialTitle, initialThemes, initialItems]);

  // Purely local UI state, not persisted, so it survives a refresh but
  // resets to defaults ("Status" sort) on a fresh page load.
  const [present, setPresent] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [sortMode, setSortMode] = useState('status');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = "add" mode
  const [itemForm, setItemForm] = useState({ title: '', description: '', status: 'now', when: '', themeIds: [] });

  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [themeNameInput, setThemeNameInput] = useState('');

  const [reorderOpen, setReorderOpen] = useState(false);

  const untaggedItems = items.filter((i) => i.themeLinks.length === 0);

  // Keep the active tab pointed at something real once themes/items load or change.
  useEffect(() => {
    const validThemeIds = themes.map((t) => t.id);
    const stillValid = validThemeIds.includes(activeTab) || (activeTab === 'untagged' && untaggedItems.length > 0);
    if (!stillValid) {
      setActiveTab(themes.length ? themes[0].id : (untaggedItems.length ? 'untagged' : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themes, items]);

  function itemsForTheme(themeId) {
    return items
      .filter((i) => i.themeLinks.some((l) => l.themeId === themeId))
      .sort((a, b) => themePosition(a, themeId) - themePosition(b, themeId));
  }

  // Attaches the names of an item's *other* themes (all except the one
  // whose section is currently being rendered) so ItemRow can show them as tags.
  function withOtherThemeNames(list, excludeThemeId) {
    return list.map((item) => ({
      ...item,
      _otherThemeNames: item.themeLinks
        .filter((l) => l.themeId !== excludeThemeId)
        .map((l) => themes.find((t) => t.id === l.themeId)?.name)
        .filter(Boolean),
    }));
  }

  async function handleRenameTheme(theme, name) {
    const clean = name.trim() || 'Untitled theme';
    setThemes((prev) => prev.map((t) => (t.id === theme.id ? { ...t, name: clean } : t)));
    setEditingThemeId(null);
    await renameTheme(theme.id, clean);
    router.refresh();
  }

  async function handleDeleteTheme(theme) {
    if (!confirm(`Delete "${theme.name}"? Items tagged with it will keep their other themes.`)) return;
    await deleteTheme(theme.id);
    if (activeTab === theme.id) setActiveTab(null);
    router.refresh();
  }

  async function handleAddTheme() {
    const name = themeNameInput.trim();
    if (!name) return;
    const created = await createTheme(name);
    setThemeModalOpen(false);
    setThemeNameInput('');
    if (created) setActiveTab(created.id);
    router.refresh();
  }

  function openAddItemModal(defaultThemeId) {
    setEditingItem(null);
    setItemForm({ title: '', description: '', status: 'now', when: '', themeIds: defaultThemeId ? [defaultThemeId] : [] });
    setItemModalOpen(true);
  }

  function openEditItemModal(item) {
    setEditingItem(item);
    setItemForm({
      title: item.title,
      description: item.description || '',
      status: item.status,
      when: item.when || '',
      themeIds: item.themeLinks.map((l) => l.themeId),
    });
    setItemModalOpen(true);
  }

  async function handleSaveItem() {
    const title = itemForm.title.trim();
    if (!title) return;
    const payload = { ...itemForm, title };

    if (editingItem) {
      await updateItem(editingItem.id, payload);
    } else {
      await createItem(payload);
    }
    if (payload.themeIds.length && !payload.themeIds.includes(activeTab)) {
      setActiveTab(payload.themeIds[0]);
    }
    setItemModalOpen(false);
    router.refresh();
  }

  async function handleDeleteItem() {
    if (!editingItem) return;
    await deleteItem(editingItem.id);
    setItemModalOpen(false);
    router.refresh();
  }

  async function moveItem(themeId, itemId, direction) {
    const sorted = getSortedItems(itemsForTheme(themeId), sortMode);
    const idx = sorted.findIndex((i) => i.id === itemId);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
    if (sorted[swapIdx].status !== sorted[idx].status) return; // stay within the status group
    const next = sorted.slice();
    const tmp = next[idx];
    next[idx] = next[swapIdx];
    next[swapIdx] = tmp;
    const orderedIds = next.map((i) => i.id);
    await reorderThemeItems(themeId, orderedIds);
    router.refresh();
  }

  async function moveTheme(themeId, direction) {
    const idx = themes.findIndex((t) => t.id === themeId);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= themes.length) return;
    const next = themes.slice();
    const tmp = next[idx];
    next[idx] = next[swapIdx];
    next[swapIdx] = tmp;
    setThemes(next);
    await reorderThemes(next.map((t) => t.id));
    router.refresh();
  }

  async function handleTitleCommit(value) {
    const clean = value.trim() || 'New Roadmap';
    setTitle(clean);
    setEditingTitle(false);
    await updateTitle(clean);
    router.refresh();
  }

  function handleExport() {
    const payload = { title, themes, items, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (title || 'roadmap').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'roadmap';
    a.download = `${safeTitle}-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function toggleThemeCheckbox(themeId) {
    setItemForm((prev) => {
      const has = prev.themeIds.includes(themeId);
      return { ...prev, themeIds: has ? prev.themeIds.filter((id) => id !== themeId) : [...prev.themeIds, themeId] };
    });
  }

  const activeTheme = themes.find((t) => t.id === activeTab) || null;
  const showingUntagged = activeTab === 'untagged';

  return (
    <div className={present ? 'present' : ''} style={{ display: 'contents' }}>
      <div className="wrap">
        <header className="top">
          <div className="title-block">
            {editingTitle && !present ? (
              <input
                className="title-input"
                autoFocus
                defaultValue={title}
                onBlur={(e) => handleTitleCommit(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
            ) : (
              <h1 onClick={() => !present && setEditingTitle(true)}>{title}</h1>
            )}
            <div className="meta">{items.length === 0 ? 'No items yet' : `${items.length} item${items.length === 1 ? '' : 's'} on the roadmap`}</div>
          </div>
          <div className="mode-toggle">
            {!present && <button className="btn no-present" onClick={handleExport}>Export data</button>}
            {!present && themes.length >= 2 && (
              <button className="btn no-present" onClick={() => setReorderOpen(true)}>Reorder themes</button>
            )}
            {!present && <button className="btn no-present" onClick={() => setThemeModalOpen(true)}>+ Theme</button>}
            <button className="btn" onClick={() => setPresent((p) => !p)}>{present ? 'Edit' : 'Present'}</button>
          </div>
        </header>

        {themes.length === 0 ? (
          <div className="empty-state">
            <h2>Nothing on the roadmap yet</h2>
            <p>Group your work into themes stakeholders will recognize.</p>
            {!present && (
              <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setThemeModalOpen(true)}>
                Add your first theme
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="tabs-wrap">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  className={`tab-btn${activeTab === theme.id ? ' active' : ''}`}
                  style={{ '--tab-accent': `var(--${theme.color})`, '--tab-accent-tint': `var(--${theme.color}-tint)` }}
                  onClick={() => setActiveTab(theme.id)}
                >
                  <span>{theme.name}</span>
                  <span className="tab-count">{itemsForTheme(theme.id).length}</span>
                </button>
              ))}
              {untaggedItems.length > 0 && (
                <button
                  className={`tab-btn${activeTab === 'untagged' ? ' active' : ''}`}
                  onClick={() => setActiveTab('untagged')}
                >
                  <span>Untagged</span>
                  <span className="tab-count">{untaggedItems.length}</span>
                </button>
              )}
            </div>

            <div className="sort-bar">
              <span>Sort by</span>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`sort-btn${sortMode === opt.id ? ' active' : ''}`}
                  onClick={() => setSortMode(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {showingUntagged ? (
              <UntaggedBlock items={withOtherThemeNames(getSortedItems(untaggedItems, sortMode), null)} onEdit={openEditItemModal} />
            ) : activeTheme ? (
              <ThemeBlock
                theme={activeTheme}
                items={withOtherThemeNames(getSortedItems(itemsForTheme(activeTheme.id), sortMode), activeTheme.id)}
                present={present}
                sortMode={sortMode}
                editing={editingThemeId === activeTheme.id}
                onStartRename={() => !present && setEditingThemeId(activeTheme.id)}
                onCommitRename={(name) => handleRenameTheme(activeTheme, name)}
                onDelete={() => handleDeleteTheme(activeTheme)}
                onAddItem={() => openAddItemModal(activeTheme.id)}
                onEditItem={openEditItemModal}
                onMoveItem={(itemId, dir) => moveItem(activeTheme.id, itemId, dir)}
              />
            ) : null}
          </>
        )}
      </div>

      {itemModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setItemModalOpen(false); }}>
          <div className="modal">
            <h3>{editingItem ? 'Edit item' : 'Add item'}</h3>
            <div className="field">
              <label>Title</label>
              <input
                autoFocus
                value={itemForm.title}
                onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                placeholder="e.g. Mobile check-in flow"
              />
            </div>
            <div className="field">
              <label>Description (optional)</label>
              <textarea
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="One line stakeholders will understand"
              />
            </div>
            <div className="field">
              <label>Themes (an item can belong to more than one)</label>
              <div className="theme-checks">
                {themes.length === 0 && <div className="theme-checks-empty">No themes yet, add one first.</div>}
                {themes.map((t) => (
                  <label className="theme-check-row" key={t.id}>
                    <input
                      type="checkbox"
                      checked={itemForm.themeIds.includes(t.id)}
                      onChange={() => toggleThemeCheckbox(t.id)}
                    />
                    <span className="theme-dot" style={{ background: `var(--${t.color})` }} />
                    <span>{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={itemForm.status} onChange={(e) => setItemForm({ ...itemForm, status: e.target.value })}>
                <option value="now">Now</option>
                <option value="next">Next</option>
                <option value="later">Later</option>
              </select>
            </div>
            <div className="field">
              <label>Target date or quarter (optional)</label>
              <input
                value={itemForm.when}
                onChange={(e) => setItemForm({ ...itemForm, when: e.target.value })}
                placeholder="e.g. Q3 2026"
              />
            </div>
            <div className="modal-actions">
              {editingItem ? <button className="btn ghost" onClick={handleDeleteItem}>Delete</button> : <span />}
              <div className="right">
                <button className="btn" onClick={() => setItemModalOpen(false)}>Cancel</button>
                <button className="btn primary" onClick={handleSaveItem}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {themeModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setThemeModalOpen(false); }}>
          <div className="modal">
            <h3>Add theme</h3>
            <div className="field">
              <label>Theme name</label>
              <input
                autoFocus
                value={themeNameInput}
                onChange={(e) => setThemeNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTheme(); }}
                placeholder="e.g. Access Control"
              />
            </div>
            <div className="modal-actions">
              <span />
              <div className="right">
                <button className="btn" onClick={() => setThemeModalOpen(false)}>Cancel</button>
                <button className="btn primary" onClick={handleAddTheme}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reorderOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setReorderOpen(false); }}>
          <div className="modal">
            <h3>Reorder themes</h3>
            {themes.map((theme, idx) => (
              <div className="reorder-row" key={theme.id}>
                <span className="theme-dot" style={{ background: `var(--${theme.color})` }} />
                <span className="name">{theme.name}</span>
                <button className="icon-btn" disabled={idx === 0} onClick={() => moveTheme(theme.id, -1)}>↑</button>
                <button className="icon-btn" disabled={idx === themes.length - 1} onClick={() => moveTheme(theme.id, 1)}>↓</button>
              </div>
            ))}
            <div className="modal-actions">
              <span />
              <div className="right">
                <button className="btn primary" onClick={() => setReorderOpen(false)}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeBlock({ theme, items, present, sortMode, editing, onStartRename, onCommitRename, onDelete, onAddItem, onEditItem, onMoveItem }) {
  const accentVar = `var(--${theme.color})`;
  const tintVar = `var(--${theme.color}-tint)`;

  return (
    <div className="theme-block">
      <div className="theme-head" style={{ '--accent': accentVar, '--accent-tint': tintVar, borderLeftColor: accentVar }}>
        {editing ? (
          <input
            className="theme-name-input"
            autoFocus
            defaultValue={theme.name}
            onBlur={(e) => onCommitRename(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
        ) : (
          <h2 onClick={onStartRename}>{theme.name}</h2>
        )}
        <span className="count">{items.length} item{items.length === 1 ? '' : 's'}</span>
        {!present && (
          <div className="theme-actions">
            <button className="icon-btn" title="Delete theme (items stay, just untagged from it)" onClick={onDelete}>✕</button>
          </div>
        )}
      </div>

      {items.map((item, idx) => (
        <ItemRow
          key={item.id}
          item={item}
          accentVar={accentVar}
          tintVar={tintVar}
          showTagsExcept={theme.id}
          present={present}
          onEdit={() => onEditItem(item)}
          reorder={
            sortMode === 'status'
              ? {
                  isFirst: idx === 0 || items[idx - 1].status !== item.status,
                  isLast: idx === items.length - 1 || items[idx + 1].status !== item.status,
                  onUp: () => onMoveItem(item.id, -1),
                  onDown: () => onMoveItem(item.id, 1),
                }
              : null
          }
        />
      ))}

      {!present && (
        <button className="add-item-row" onClick={onAddItem}>+ Add item to {theme.name}</button>
      )}
    </div>
  );
}

function UntaggedBlock({ items, onEdit }) {
  return (
    <div className="theme-block">
      <div className="theme-head" style={{ borderLeftColor: 'var(--border-strong)' }}>
        <h2>Untagged</h2>
        <span className="count">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} accentVar="var(--muted)" tintVar="var(--border)" showTagsExcept={null} present={false} onEdit={() => onEdit(item)} reorder={null} />
      ))}
    </div>
  );
}

function ItemRow({ item, accentVar, tintVar, showTagsExcept, present, onEdit, reorder }) {
  return (
    <div className="item" style={{ '--accent': accentVar, '--accent-tint': tintVar }}>
      <span className={`pill ${item.status}`}>{STATUS_LABEL[item.status] || 'Now'}</span>
      <div className="item-body">
        <div className="item-title">{item.title}</div>
        {item.description && <div className="item-desc">{item.description}</div>}
        {item._otherThemeNames && item._otherThemeNames.length > 0 && (
          <div className="item-tags">
            {item._otherThemeNames.map((name) => (
              <span className="item-tag" key={name}>{name}</span>
            ))}
          </div>
        )}
      </div>
      {item.when && <div className="item-when">{item.when}</div>}
      {!present && (
        <div className="item-actions">
          {reorder && (
            <>
              <button className="icon-btn" disabled={reorder.isFirst} onClick={reorder.onUp} title="Move up">↑</button>
              <button className="icon-btn" disabled={reorder.isLast} onClick={reorder.onDown} title="Move down">↓</button>
            </>
          )}
          <button className="icon-btn" onClick={onEdit} title="Edit">✎</button>
        </div>
      )}
    </div>
  );
}
