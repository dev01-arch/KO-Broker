/**
 * Iframe-safe lender combobox (PRD-16 W1).
 * Queries GET /api/lenders when searchFn is provided; falls back to the local seed.
 */

import { OTHER_LENDER_NAME, resolveLenderSelection, searchLenders, type LenderSearchHit } from './directory';

export type LenderSelectValue = {
  lenderName: string;
  lenderId?: string;
  lenderOtherName?: string;
};

export type LenderSelectInstance = {
  getValue: () => string;
  getSelection: () => LenderSelectValue;
  setValue: (name: string) => void;
  destroy: () => void;
};

export type MountLenderSelectOptions = {
  nameAttr?: string;
  placeholder?: string;
  initialValue?: string;
  hiddenClass?: string;
  extraHiddenAttrs?: Record<string, string>;
  fieldStyle?: string;
  onChange?: (value: string, selection: LenderSelectValue) => void;
  searchFn?: (query: string) => Promise<LenderSearchHit[]>;
};

const instances = new WeakMap<HTMLElement, LenderSelectInstance>();

const FIELD =
  "width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;color:#18181b;font-family:'DM Sans',sans-serif;background:#fff;text-align:left";

export function mountLenderSelect(
  host: HTMLElement,
  options?: MountLenderSelectOptions,
): LenderSelectInstance {
  instances.get(host)?.destroy();

  const doc = host.ownerDocument;
  const placeholder = options?.placeholder ?? 'Search lenders…';
  const nameAttr = options?.nameAttr ?? 'data-ko-prod="lender"';
  const fieldStyle = options?.fieldStyle ?? FIELD;
  const resolved = resolveLenderSelection(options?.initialValue ?? '');

  let selectedName = resolved.selectedName;
  let otherName = resolved.otherName;
  let selectedId = '';
  let open = false;
  let activeIndex = 0;
  let hits: LenderSearchHit[] = searchLenders('');
  let searchTimer: number | null = null;

  const root = doc.createElement('div');
  root.setAttribute('data-ko-lender-select', '');
  root.style.cssText = 'position:relative;width:100%;';

  const hidden = doc.createElement('input');
  hidden.type = 'hidden';
  if (options?.hiddenClass) hidden.className = options.hiddenClass;
  const attrMatch = nameAttr.match(/^([^=]+)="([^"]+)"$/);
  if (attrMatch) hidden.setAttribute(attrMatch[1], attrMatch[2]);
  else hidden.setAttribute('data-ko-prod', 'lender');
  if (options?.extraHiddenAttrs) {
    Object.entries(options.extraHiddenAttrs).forEach(([key, val]) => hidden.setAttribute(key, val));
  }

  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.setAttribute('aria-haspopup', 'listbox');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.style.cssText = `${fieldStyle};cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:38px`;
  const toggleLabel = doc.createElement('span');
  toggleLabel.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a1a1aa';
  toggleLabel.textContent = placeholder;
  const chevron = doc.createElement('span');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.style.cssText = 'flex-shrink:0;color:#71717a;font-size:10px';
  chevron.textContent = '▾';
  toggle.append(toggleLabel, chevron);

  const menu = doc.createElement('div');
  menu.hidden = true;
  menu.style.cssText =
    'position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:40;background:#fff;border:1px solid #e4e4e7;border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,0.12);overflow:hidden';

  const search = doc.createElement('input');
  search.type = 'search';
  search.setAttribute('aria-label', 'Search lenders');
  search.placeholder = 'Type to search';
  search.autocomplete = 'off';
  search.style.cssText = `${fieldStyle};border:none;border-bottom:1px solid #f4f4f5;border-radius:0`;

  const list = doc.createElement('ul');
  list.setAttribute('role', 'listbox');
  list.style.cssText = 'list-style:none;margin:0;padding:4px;max-height:220px;overflow-y:auto';

  const otherWrap = doc.createElement('div');
  otherWrap.hidden = true;
  otherWrap.style.cssText = 'margin-top:6px';
  const otherInput = doc.createElement('input');
  otherInput.type = 'text';
  otherInput.setAttribute('aria-label', 'Other lender name');
  otherInput.placeholder = 'Type the lender name';
  otherInput.style.cssText = fieldStyle;
  otherWrap.appendChild(otherInput);

  menu.append(search, list);
  root.append(hidden, toggle, menu, otherWrap);
  host.replaceChildren(root);

  const syncHidden = () => {
    if (selectedName === OTHER_LENDER_NAME) {
      hidden.value = otherName.trim();
    } else {
      hidden.value = selectedName;
    }
    if (selectedId) hidden.setAttribute('data-lender-id', selectedId);
    else hidden.removeAttribute('data-lender-id');
  };

  const currentSelection = (): LenderSelectValue => ({
    lenderName: hidden.value.trim() || selectedName,
    lenderId: selectedId || undefined,
    lenderOtherName:
      selectedName === OTHER_LENDER_NAME ? otherName.trim() || undefined : undefined,
  });

  let primed = false;

  const emitChange = () => {
    syncHidden();
    options?.onChange?.(hidden.value.trim(), currentSelection());
    const Evt = doc.defaultView?.Event ?? Event;
    hidden.dispatchEvent(new Evt('input', { bubbles: true }));
    hidden.dispatchEvent(new Evt('change', { bubbles: true }));
  };

  const paintToggle = () => {
    if (selectedName && selectedName !== OTHER_LENDER_NAME) {
      toggleLabel.textContent = selectedName;
      toggleLabel.style.color = '#18181b';
    } else if (selectedName === OTHER_LENDER_NAME && otherName.trim()) {
      toggleLabel.textContent = otherName.trim();
      toggleLabel.style.color = '#18181b';
    } else if (selectedName === OTHER_LENDER_NAME) {
      toggleLabel.textContent = 'Other…';
      toggleLabel.style.color = '#18181b';
    } else {
      toggleLabel.textContent = placeholder;
      toggleLabel.style.color = '#a1a1aa';
    }
    otherWrap.hidden = selectedName !== OTHER_LENDER_NAME;
    if (primed) emitChange();
    else syncHidden();
  };

  const positionMenu = () => {
    const view = doc.defaultView;
    const narrow = (view?.innerWidth ?? 1280) < 400;
    if (narrow) {
      menu.style.position = 'fixed';
      menu.style.left = '12px';
      menu.style.right = '12px';
      menu.style.top = 'auto';
      menu.style.bottom = '12px';
      menu.style.maxHeight = 'min(320px, 55vh)';
    } else {
      menu.style.position = 'absolute';
      menu.style.left = '0';
      menu.style.right = '0';
      menu.style.top = 'calc(100% + 4px)';
      menu.style.bottom = 'auto';
      menu.style.maxHeight = '';
    }
  };

  const paintList = () => {
    list.replaceChildren();
    hits.forEach((hit, index) => {
      const li = doc.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('data-index', String(index));
      li.textContent = hit.isOther ? 'Other…' : hit.name;
      const active = index === activeIndex;
      li.style.cssText = `padding:8px 10px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;color:${hit.isOther ? '#52525b' : '#18181b'};background:${active ? '#E1F5EE' : 'transparent'};font-weight:${hit.isOther ? '600' : '400'}`;
      li.addEventListener('mousedown', (event) => {
        event.preventDefault();
        choose(index);
      });
      list.appendChild(li);
    });
  };

  const choose = (index: number) => {
    const hit = hits[index];
    if (!hit) return;
    selectedName = hit.name;
    selectedId = hit.id ?? '';
    if (!hit.isOther) otherName = '';
    setOpen(false);
    paintToggle();
    if (hit.isOther) {
      otherInput.focus();
    }
  };

  const applyHits = (next: LenderSearchHit[]) => {
    hits = next.length ? next : searchLenders(search.value);
    activeIndex = 0;
    paintList();
  };

  const refreshHits = (query: string) => {
    if (!options?.searchFn) {
      applyHits(searchLenders(query));
      return;
    }
    if (searchTimer != null) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      void options.searchFn?.(query).then((rows) => {
        if (!host.isConnected) return;
        applyHits(rows);
      }).catch(() => {
        if (!host.isConnected) return;
        applyHits(searchLenders(query));
      });
    }, 180);
  };

  const setOpen = (next: boolean) => {
    open = next;
    menu.hidden = !next;
    toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      refreshHits(search.value);
      positionMenu();
      paintList();
      search.focus();
      search.select();
    }
  };

  const onDocPointer = (event: Event) => {
    if (!host.isConnected) {
      destroy();
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (root.contains(target)) return;
    if (open) setOpen(false);
  };

  toggle.addEventListener('click', () => {
    setOpen(!open);
  });

  search.addEventListener('input', () => {
    refreshHits(search.value);
  });

  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(hits.length - 1, activeIndex + 1);
      paintList();
      list.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      paintList();
      list.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      toggle.focus();
    }
  });

  otherInput.addEventListener('input', () => {
    otherName = otherInput.value;
    paintToggle();
  });

  doc.addEventListener('mousedown', onDocPointer);
  doc.defaultView?.addEventListener('resize', positionMenu);

  function destroy() {
    if (searchTimer != null) window.clearTimeout(searchTimer);
    doc.removeEventListener('mousedown', onDocPointer);
    doc.defaultView?.removeEventListener('resize', positionMenu);
    instances.delete(host);
    if (host.contains(root)) root.remove();
  }

  const instance: LenderSelectInstance = {
    getValue: () => hidden.value.trim(),
    getSelection: () => {
      syncHidden();
      return currentSelection();
    },
    setValue: (name: string) => {
      const next = resolveLenderSelection(name);
      selectedName = next.selectedName;
      otherName = next.otherName;
      selectedId = '';
      otherInput.value = otherName;
      const wasPrimed = primed;
      primed = false;
      paintToggle();
      primed = wasPrimed;
      syncHidden();
    },
    destroy,
  };
  instances.set(host, instance);
  paintToggle();
  primed = true;
  return instance;
}
