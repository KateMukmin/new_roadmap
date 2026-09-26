'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createItem,
  createTheme,
  deleteItem,
  deleteTheme,
  importRoadmapData,
  renameTheme,
  reorderThemeItems,
  reorderThemes,
  updateItem,
  updateTitle,
} from '@/lib/actions';
import { STATUS_LABEL, getSortedItems, themePosition, dateBucketLabel, parseWhenValue, ACCENT_HEX, UNTAGGED_HEX, ACCENTS, containsUrl, linkifyParts } from '@/lib/roadmapUtils';

const SORT_OPTIONS = [
  { id: 'status', label: 'Status' },
  { id: 'title', label: 'Feature title' },
  { id: 'date', label: 'Delivery date' },
];

const VIEW_OPTIONS = [
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'all', label: 'All features' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'byTheme', label: 'By theme' },
  { id: 'byDate', label: 'By date' },
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
  const [view, setView] = useState('roadmap');
  const [activeTab, setActiveTab] = useState(null);
  const [sortMode, setSortMode] = useState('status');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = "add" mode
  const [itemForm, setItemForm] = useState({ title: '', description: '', status: 'now', when: '', themeIds: [], phases: [] });

  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [themeNameInput, setThemeNameInput] = useState('');

  const [reorderOpen, setReorderOpen] = useState(false);
  const [showReleased, setShowReleased] = useState(false);
  const [linkFilter, setLinkFilter] = useState('all'); // 'all' | 'linked' | 'unlinked'
  const [searchQuery, setSearchQuery] = useState('');

  const visibleItems = showReleased ? items : items.filter((i) => i.status !== 'released');
  const displayItems = visibleItems.filter((i) => {
    const hasLink = !!(i.description && i.description.trim());
    if (linkFilter === 'linked') return hasLink;
    if (linkFilter === 'unlinked') return !hasLink;
    return true;
  });
  const untaggedItems = displayItems.filter((i) => i.themeLinks.length === 0);

  // Keep the active tab pointed at something real once themes/items load or change.
  useEffect(() => {
    const validThemeIds = themes.map((t) => t.id);
    const stillValid = validThemeIds.includes(activeTab) || (activeTab === 'untagged' && untaggedItems.length > 0);
    if (!stillValid) {
      setActiveTab(themes.length ? themes[0].id : (untaggedItems.length ? 'untagged' : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themes, items, showReleased, linkFilter]);

  function itemsForTheme(themeId) {
    return displayItems
      .filter((i) => i.themeLinks.some((l) => l.themeId === themeId))
      .sort((a, b) => themePosition(a, themeId) - themePosition(b, themeId));
  }

  function matchesSearch(item) {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.description && item.description.toLowerCase().includes(q)) return true;
    if (item.phases && item.phases.some((p) => p.label.toLowerCase().includes(q))) return true;
    const themeNames = item.themeLinks
      .map((l) => (themes.find((t) => t.id === l.themeId) || {}).name || '')
      .join(' ')
      .toLowerCase();
    return themeNames.includes(q);
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
    setItemForm({ title: '', description: '', status: 'now', when: '', themeIds: defaultThemeId ? [defaultThemeId] : [], phases: [] });
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
      phases: (item.phases || []).map((p) => ({ label: p.label, when: p.when })),
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

  const importInputRef = useRef(null);

  function handleImportClick() {
    if (importInputRef.current) importInputRef.current.click();
  }

  async function handleImportFileChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // reset so picking the same file again still fires onChange
    if (!file) return;

    let parsed;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch (err) {
      alert("Couldn't read that file, make sure it's the JSON file from an Export.");
      return;
    }

    const themeCount = Array.isArray(parsed.themes) ? parsed.themes.length : 0;
    const itemCount = Array.isArray(parsed.items) ? parsed.items.length : 0;
    if (!themeCount && !itemCount) {
      alert("That file doesn't look like a roadmap export, nothing to import.");
      return;
    }
    const proceed = confirm(
      `Import ${themeCount} theme(s) and ${itemCount} item(s) from "${file.name}"?\n\n` +
      `This adds them on top of what's already here, it doesn't check for duplicates. ` +
      `Only import a file once.`
    );
    if (!proceed) return;

    const result = await importRoadmapData(parsed);
    router.refresh();
    alert(`Imported ${result.themeCount} theme(s) and ${result.itemCount} item(s).`);
  }

  function toggleThemeCheckbox(themeId) {
    setItemForm((prev) => {
      const has = prev.themeIds.includes(themeId);
      return { ...prev, themeIds: has ? prev.themeIds.filter((id) => id !== themeId) : [...prev.themeIds, themeId] };
    });
  }

  function addPhaseRow() {
    setItemForm((prev) => ({ ...prev, phases: [...prev.phases, { label: '', when: '' }] }));
  }

  function updatePhaseRow(index, field, value) {
    setItemForm((prev) => {
      const phases = prev.phases.slice();
      phases[index] = { ...phases[index], [field]: value };
      return { ...prev, phases };
    });
  }

  function removePhaseRow(index) {
    setItemForm((prev) => ({ ...prev, phases: prev.phases.filter((_, i) => i !== index) }));
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
            <div className="meta">{displayItems.length === 0 ? 'No items yet' : <>{<CountLabel items={displayItems} />} on the roadmap</>}</div>
          </div>
          <div className="mode-toggle">
            {!present && <button className="btn no-present" onClick={handleExport}>Export data</button>}
            {!present && <button className="btn no-present" onClick={handleImportClick}>Import data</button>}
            <input
              type="file"
              accept="application/json"
              ref={importInputRef}
              style={{ display: 'none' }}
              onChange={handleImportFileChange}
            />
            {!present && themes.length >= 2 && (
              <button className="btn no-present" onClick={() => setReorderOpen(true)}>Reorder themes</button>
            )}
            {!present && <button className="btn no-present" onClick={() => setThemeModalOpen(true)}>+ Theme</button>}
            <label className="released-toggle">
              <input type="checkbox" checked={showReleased} onChange={(e) => setShowReleased(e.target.checked)} />
              Show released
            </label>
            <div className="link-filter">
              <span>Links:</span>
              {['all', 'linked', 'unlinked'].map((opt) => (
                <button
                  key={opt}
                  className={`sort-btn${linkFilter === opt ? ' active' : ''}`}
                  onClick={() => setLinkFilter(opt)}
                >
                  {opt === 'all' ? 'All' : opt === 'linked' ? 'Linked' : 'Unlinked'}
                </button>
              ))}
            </div>
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
            <div className="view-bar">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`view-btn${view === opt.id ? ' active' : ''}`}
                  onClick={() => setView(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="search-bar">
              <input
                type="text"
                className="search-input"
                placeholder="Search features, descriptions, phases, themes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="btn ghost" onClick={() => setSearchQuery('')}>Clear</button>
              )}
            </div>

            {searchQuery.trim() ? (
              <AllItemsBlock
                title={`Search results for "${searchQuery.trim()}"`}
                emptyMessage="No matches. Try a different search term."
                items={withOtherThemeNames(getSortedItems(displayItems.filter(matchesSearch), sortMode), null)}
                present={present}
                onEditItem={openEditItemModal}
              />
            ) : (
              <>
                {view === 'gantt' && <GanttView items={displayItems} themes={themes} />}
                {view === 'byTheme' && <ThemePieView items={displayItems} themes={themes} itemsForTheme={itemsForTheme} />}
                {view === 'byDate' && <DatePieView items={displayItems} />}

                {(view === 'roadmap' || view === 'all') && (
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
                )}

                {view === 'all' && (
                  <AllItemsBlock
                    items={withOtherThemeNames(getSortedItems(displayItems, sortMode), null)}
                    present={present}
                    onEditItem={openEditItemModal}
                  />
                )}

                {view === 'roadmap' && (
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
              </>
            )}
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
              <label>Jira epic link (optional)</label>
              <textarea
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="Paste the Jira epic URL"
              />
              {containsUrl(itemForm.description) && (
                <div className="link-preview">
                  {linkifyParts(itemForm.description).map((part, i) =>
                    typeof part === 'string' ? (
                      <span key={i}>{part}</span>
                    ) : (
                      <a key={i} href={part.url} target="_blank" rel="noopener noreferrer">{part.url}</a>
                    )
                  )}
                </div>
              )}
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
                <option value="released">Released</option>
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
            <div className="field">
              <label>Phases (optional) &mdash; split this into steps with their own dates</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {itemForm.phases.map((p, i) => (
                  <div className="phase-edit-row" key={i}>
                    <input
                      style={{ flex: 2 }}
                      value={p.label}
                      onChange={(e) => updatePhaseRow(i, 'label', e.target.value)}
                      placeholder="Phase name"
                    />
                    <input
                      style={{ flex: 1 }}
                      value={p.when}
                      onChange={(e) => updatePhaseRow(i, 'when', e.target.value)}
                      placeholder="Target date"
                    />
                    <button type="button" className="icon-btn" title="Remove phase" onClick={() => removePhaseRow(i)}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn" style={{ marginTop: 8 }} onClick={addPhaseRow}>+ Add phase</button>
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
        <span className="count"><CountLabel items={items} /></span>
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

function CountLabel({ items }) {
  const itemCount = items.length;
  const phaseCount = items.reduce((sum, i) => sum + ((i.phases && i.phases.length) || 0), 0);
  const linkedCount = items.filter((i) => i.description && i.description.trim()).length;
  const allLinked = itemCount > 0 && linkedCount === itemCount;

  const base = `${itemCount} item${itemCount === 1 ? '' : 's'}` +
    (phaseCount > 0 ? ` + ${phaseCount} feature phase${phaseCount === 1 ? '' : 's'}` : '');

  if (linkedCount === 0) return <>{base}</>;

  return (
    <>
      {base}, <span className={allLinked ? 'count-highlight' : undefined}>{linkedCount} item{linkedCount === 1 ? '' : 's'} linked</span>
    </>
  );
}

function AllItemsBlock({ items, present, onEditItem, title = 'All features', emptyMessage = 'Add some items first.' }) {
  return (
    <div className="theme-block">
      <div className="theme-head" style={{ borderLeftColor: 'var(--border-strong)' }}>
        <h2>{title}</h2>
        <span className="count"><CountLabel items={items} /></span>
      </div>
      {items.length === 0 ? (
        <div className="empty-state"><h2>Nothing here</h2><p>{emptyMessage}</p></div>
      ) : (
        items.map((item) => (
          <ItemRow key={item.id} item={item} accentVar="var(--muted)" tintVar="var(--border)" showTagsExcept={null} present={present} onEdit={() => onEditItem(item)} reorder={null} />
        ))
      )}
    </div>
  );
}

function UntaggedBlock({ items, onEdit }) {
  return (
    <div className="theme-block">
      <div className="theme-head" style={{ borderLeftColor: 'var(--border-strong)' }}>
        <h2>Untagged</h2>
        <span className="count"><CountLabel items={items} /></span>
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
        <div className="item-title">
          {item.title}
          {item.description && (
            <span className="item-link-badge" title="Has a linked Jira epic — open the item to view">Linked</span>
          )}
        </div>
        {item.phases && item.phases.length > 0 && (
          <div className="subitems">
            {item.phases.map((p) => (
              <div className="subitem-row" key={p.id}>
                <span className="label">· {p.label}</span>
                <span className="when">{p.when}</span>
              </div>
            ))}
          </div>
        )}
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

function ThemePieView({ items, themes, itemsForTheme }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    import('chart.js/auto').then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      const labels = [];
      const data = [];
      const colors = [];
      themes.forEach((t) => {
        const count = itemsForTheme(t.id).length;
        if (count === 0) return;
        labels.push(t.name);
        data.push(count);
        colors.push(ACCENT_HEX[t.color] || UNTAGGED_HEX);
      });
      const untaggedCount = items.filter((i) => i.themeLinks.length === 0).length;
      if (untaggedCount > 0) { labels.push('Untagged'); data.push(untaggedCount); colors.push(UNTAGGED_HEX); }

      if (chartRef.current) chartRef.current.destroy();
      const cardColor = getComputedStyle(document.body).getPropertyValue('--card').trim() || '#fff';
      const textColor = getComputedStyle(document.body).color;
      chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
        type: 'pie',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: cardColor, borderWidth: 2 }] },
        options: { plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { family: 'IBM Plex Sans', size: 12.5 }, padding: 14 } } } },
      });
    });
    return () => {
      cancelled = true;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, themes]);

  return (
    <div className="chart-page">
      <h2>Items by theme</h2>
      {items.length === 0 ? (
        <div className="empty-state"><h2>Nothing to chart yet</h2><p>Add some items first.</p></div>
      ) : (
        <div className="chart-canvas-wrap"><canvas ref={canvasRef} /></div>
      )}
    </div>
  );
}

function DatePieView({ items }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    import('chart.js/auto').then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;

      const buckets = {};
      items.forEach((item) => {
        const label = dateBucketLabel(item.when);
        buckets[label] = (buckets[label] || 0) + 1;
      });
      const entries = Object.keys(buckets).map((k) => ({ label: k, count: buckets[k] }));
      entries.sort((a, b) => {
        if (a.label === 'No target date') return 1;
        if (b.label === 'No target date') return -1;
        return parseWhenValue(a.label) - parseWhenValue(b.label);
      });

      const labels = entries.map((e) => e.label);
      const data = entries.map((e) => e.count);
      const colors = entries.map((e, i) => (e.label === 'No target date' ? UNTAGGED_HEX : ACCENT_HEX[ACCENTS[i % ACCENTS.length]]));

      if (chartRef.current) chartRef.current.destroy();
      const cardColor = getComputedStyle(document.body).getPropertyValue('--card').trim() || '#fff';
      const textColor = getComputedStyle(document.body).color;
      chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
        type: 'pie',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: cardColor, borderWidth: 2 }] },
        options: { plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { family: 'IBM Plex Sans', size: 12.5 }, padding: 14 } } } },
      });
    });
    return () => {
      cancelled = true;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <div className="chart-page">
      <h2>Items by target date</h2>
      {items.length === 0 ? (
        <div className="empty-state"><h2>Nothing to chart yet</h2><p>Add some items first.</p></div>
      ) : (
        <div className="chart-canvas-wrap"><canvas ref={canvasRef} /></div>
      )}
    </div>
  );
}

function GanttView({ items, themes }) {
  const rows = [];
  items.forEach((item) => {
    const points = [];
    if (item.phases && item.phases.length) {
      item.phases.forEach((p) => {
        const v = parseWhenValue(p.when);
        if (v !== Infinity) points.push({ label: p.label, when: p.when, value: v });
      });
    } else if (item.when) {
      const v2 = parseWhenValue(item.when);
      if (v2 !== Infinity) points.push({ label: null, when: item.when, value: v2 });
    }
    if (points.length) {
      points.sort((a, b) => a.value - b.value);
      rows.push({ item, points });
    }
  });

  if (rows.length === 0) {
    return (
      <div className="chart-page">
        <h2>Timeline</h2>
        <div className="empty-state">
          <h2>No dated items yet</h2>
          <p>Add a target date or phase dates to items to see them on a timeline.</p>
        </div>
      </div>
    );
  }

  rows.sort((a, b) => a.points[0].value - b.points[0].value);

  const allValues = [];
  rows.forEach((r) => r.points.forEach((p) => allValues.push(p.value)));
  let minV = Math.min(...allValues);
  let maxV = Math.max(...allValues);
  if (minV === maxV) { minV -= 1000 * 60 * 60 * 24 * 30; maxV += 1000 * 60 * 60 * 24 * 30; }
  let span = maxV - minV;
  const pad = span * 0.08;
  minV -= pad; maxV += pad; span = maxV - minV;

  const labelColW = 190;
  const chartW = 560;
  const rowH = 34;
  const topPad = 34;
  const totalW = labelColW + chartW + 16;
  const totalH = topPad + rows.length * rowH + 16;

  const xFor = (value) => labelColW + ((value - minV) / span) * chartW;

  const qStartSeed = new Date(minV);
  let cursor = new Date(qStartSeed.getFullYear(), Math.floor(qStartSeed.getMonth() / 3) * 3, 1).getTime();
  const ticks = [];
  let guard = 0;
  while (cursor <= maxV && guard < 40) {
    if (cursor >= minV) {
      const d = new Date(cursor);
      ticks.push({ value: cursor, label: `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}` });
    }
    const dNext = new Date(cursor);
    cursor = new Date(dNext.getFullYear(), dNext.getMonth() + 3, 1).getTime();
    guard++;
  }

  const noDateCount = items.length - rows.length;

  return (
    <div className="chart-page">
      <h2>Timeline</h2>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} width="100%" style={{ display: 'block' }}>
        {ticks.map((t) => {
          const x = xFor(t.value);
          return (
            <g key={t.value}>
              <line className="gantt-grid-line" x1={x} x2={x} y1={topPad - 8} y2={totalH - 8} strokeWidth="1" />
              <text className="gantt-tick-label" x={x} y={topPad - 14} fontSize="11" fontFamily="IBM Plex Sans, sans-serif" textAnchor="middle">{t.label}</text>
            </g>
          );
        })}
        {rows.map((row, idx) => {
          const y = topPad + idx * rowH + rowH / 2;
          const firstThemeId = row.item.themeLinks[0] && row.item.themeLinks[0].themeId;
          const theme = firstThemeId ? themes.find((t) => t.id === firstThemeId) : null;
          const color = theme ? (ACCENT_HEX[theme.color] || '#20262B') : '#20262B';
          const titleText = row.item.title.length > 24 ? row.item.title.slice(0, 23) + '…' : row.item.title;
          return (
            <g key={row.item.id}>
              <text className="gantt-row-label" x={labelColW - 12} y={y + 4} fontSize="13" fontFamily="IBM Plex Sans, sans-serif" textAnchor="end">
                {titleText}
                <title>{row.item.title}</title>
              </text>
              <line className="gantt-row-line" x1={labelColW} x2={labelColW + chartW} y1={y} y2={y} strokeWidth="1" />
              {row.points.length > 1 && (
                <line x1={xFor(row.points[0].value)} x2={xFor(row.points[row.points.length - 1].value)} y1={y} y2={y} stroke={color} strokeWidth="2" />
              )}
              {row.points.map((p, pi) => (
                <circle key={pi} cx={xFor(p.value)} cy={y} r={row.points.length > 1 ? 5 : 6} fill={color}>
                  <title>{(p.label ? p.label + ' — ' : '') + p.when}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      {noDateCount > 0 && (
        <p className="chart-note">
          {noDateCount} item{noDateCount === 1 ? '' : 's'} {noDateCount === 1 ? "isn't" : "aren't"} shown here (no target date set).
        </p>
      )}
    </div>
  );
}
