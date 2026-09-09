'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Popover from '@radix-ui/react-popover';
import Icon from './Icon';

export type SelectOption = {
  value: string;
  label: string;
  detail?: string;
  keywords?: string;
};

export type SelectControlProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  variant?: 'field' | 'quiet' | 'language';
  icon?: ReactNode;
  align?: 'start' | 'end';
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
};

function Chevron() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>;
}

function searchText(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export default function SelectControl({ label, value, options, onValueChange, variant = 'field', icon, align = 'start', searchable = false, searchPlaceholder, emptyText, id }: SelectControlProps) {
  const choices = useMemo(() => {
    const distinct = [...new Map(options.map(option => [option.value, option])).values()];
    // An unrecognized query-string value must remain visible until changed.
    if (!distinct.some(option => option.value === value)) {
      distinct.unshift({ value, label: value || label });
    }
    return distinct;
  }, [options, value, label]);
  const selected = choices.find(option => option.value === value)!;

  if (searchable) {
    return <SearchableSelect label={label} value={value} options={choices} onValueChange={onValueChange} variant={variant} icon={icon} align={align} searchPlaceholder={searchPlaceholder} emptyText={emptyText} id={id}/>;
  }

  // Radix reserves the empty string. Choose a token absent from every real value.
  let emptyValue = '__ags_select_empty__';
  const values = new Set(choices.map(option => option.value));
  while (values.has(emptyValue)) emptyValue += '_';
  const toRadixValue = (next: string) => next === '' ? emptyValue : next;

  return <div className={`select-control select-${variant}`}>
    <Select.Root value={toRadixValue(value)} onValueChange={next => onValueChange(next === emptyValue ? '' : next)}>
      <Select.Trigger id={id} className="select-trigger" aria-label={label}>
        {icon}
        <Select.Value className="select-value">{selected.label}</Select.Value>
        <Select.Icon className="select-chevron"><Chevron/></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={`picker-content picker-${variant}`} position="popper" align={align} sideOffset={8} collisionPadding={12}>
          <Select.ScrollUpButton className="picker-scroll-button"><span style={{ transform: 'rotate(180deg)' }}><Chevron/></span></Select.ScrollUpButton>
          <Select.Viewport className="picker-viewport">
            <Select.Group>
              <Select.Label className="picker-heading">{label}</Select.Label>
              {choices.map(option => <Select.Item key={option.value} value={toRadixValue(option.value)} textValue={option.label} className="picker-option">
                <Select.ItemText className="picker-option-label">{option.label}</Select.ItemText>
                {option.detail && <span className="picker-option-detail">{option.detail}</span>}
                <Select.ItemIndicator className="picker-check"><Icon name="check" size={15}/></Select.ItemIndicator>
              </Select.Item>)}
            </Select.Group>
          </Select.Viewport>
          <Select.ScrollDownButton className="picker-scroll-button"><Chevron/></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  </div>;
}

function SearchableSelect({ label, value, options, onValueChange, variant = 'field', icon, align = 'start', searchPlaceholder, emptyText, id }: SelectControlProps) {
  const instanceId = useId();
  const listId = `${instanceId}-list`;
  const headingId = `${instanceId}-heading`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeOptionRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const restoreFocusRef = useRef(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeValue, setActiveValue] = useState<string | null>(value);
  const selected = options.find(option => option.value === value)!;
  const filtered = useMemo(() => {
    const terms = searchText(query).split(/\s+/u).filter(Boolean);
    return options.filter(option => {
      const haystack = searchText(`${option.label} ${option.keywords || ''} ${option.value}`);
      return terms.every(term => haystack.includes(term));
    });
  }, [options, query]);
  const foundIndex = filtered.findIndex(option => option.value === activeValue);
  const activeIndex = foundIndex >= 0 ? foundIndex : filtered.length ? 0 : -1;
  const activeId = activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  useEffect(() => {
    const viewport = viewportRef.current;
    const option = activeOptionRef.current;
    if (!open || !viewport || !option) return;
    // Scroll only the option list, never the document behind the portal.
    const listBounds = viewport.getBoundingClientRect();
    const itemBounds = option.getBoundingClientRect();
    if (itemBounds.top < listBounds.top) viewport.scrollTop -= listBounds.top - itemBounds.top;
    else if (itemBounds.bottom > listBounds.bottom) viewport.scrollTop += itemBounds.bottom - listBounds.bottom;
  }, [open, activeIndex, query]);

  function changeOpen(next: boolean) {
    if (next) {
      restoreFocusRef.current = true;
      setQuery('');
      setActiveValue(value);
    }
    composingRef.current = false;
    setOpen(next);
  }

  function choose(option: SelectOption) {
    restoreFocusRef.current = true;
    setOpen(false);
    onValueChange(option.value);
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    // Key 229 also covers browsers that finish composition before keydown.
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Tab') {
      restoreFocusRef.current = false;
      // Keep the browser's default Tab action, starting beside the trigger.
      triggerRef.current?.focus({ preventScroll: true });
      setOpen(false);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // Preserve text editing keys while a query is being entered.
    if (query && (event.key === 'Home' || event.key === 'End')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0) choose(filtered[activeIndex]);
      return;
    }
    let nextIndex: number;
    if (event.key === 'ArrowDown') nextIndex = Math.min(activeIndex + 1, filtered.length - 1);
    else if (event.key === 'ArrowUp') nextIndex = Math.max(activeIndex - 1, 0);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = filtered.length - 1;
    else return;
    event.preventDefault();
    if (filtered[nextIndex]) setActiveValue(filtered[nextIndex].value);
  }

  return <div className={`select-control select-${variant}`}>
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger ref={triggerRef} id={id} className="select-trigger" aria-label={`${label}: ${selected.label}`} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          changeOpen(true);
        }
      }}>
        {icon}<span className="select-value">{selected.label}</span><span className="select-chevron"><Chevron/></span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={`picker-content picker-${variant} picker-searchable`} align={align} sideOffset={8} collisionPadding={12} aria-labelledby={headingId}
          onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={event => { event.preventDefault(); if (restoreFocusRef.current) triggerRef.current?.focus({ preventScroll: true }); }}
          onInteractOutside={() => { restoreFocusRef.current = false; }}
          onEscapeKeyDown={event => { if (composingRef.current || event.isComposing || event.keyCode === 229) event.preventDefault(); }}>
          <div id={headingId} className="picker-heading">{label}</div>
          <input ref={inputRef} className="picker-search" type="text" role="combobox" aria-label={searchPlaceholder || label} aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={activeId} placeholder={searchPlaceholder} value={query} autoComplete="off" spellCheck={false}
            onChange={event => { setQuery(event.target.value); setActiveValue(null); }}
            onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }} onKeyDown={handleKeys}/>
          <div ref={viewportRef} id={listId} className="picker-viewport" role="listbox" aria-label={label}>
            {filtered.map((option, index) => <div key={option.value} ref={index === activeIndex ? activeOptionRef : undefined} id={`${listId}-${index}`} role="option" aria-selected={option.value === value} className="picker-option" data-state={option.value === value ? 'checked' : 'unchecked'} data-highlighted={index === activeIndex ? '' : undefined}
              onPointerMove={event => { if (event.pointerType === 'mouse') setActiveValue(option.value); }} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
              <span className="picker-option-label">{option.label}</span>
              {option.detail && <span className="picker-option-detail">{option.detail}</span>}
              {option.value === value && <span className="picker-check"><Icon name="check" size={15}/></span>}
            </div>)}
          </div>
          {!filtered.length && <p className="picker-empty" role="status">{emptyText || 'No results'}</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </div>;
}
