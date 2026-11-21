import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  dotColor?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  id?: string;
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = '',
  style,
  disabled = false,
  id
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    openUpward: boolean;
  }>({ top: 0, left: 0, width: 200, maxHeight: 240, openUpward: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const updatePopoverPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const estimatedHeight = Math.min(240, options.length * 36 + 10);
    const spaceBelow = viewportH - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const maxWidth = viewportW - 16;
    const width = Math.min(Math.max(rect.width, 140), maxWidth);
    const left = Math.min(Math.max(8, rect.left), viewportW - width - 8);

    if (openUpward) {
      setPopoverCoords({
        bottom: viewportH - rect.top + 5,
        left,
        width,
        maxHeight: Math.min(240, Math.max(110, spaceAbove)),
        openUpward: true
      });
    } else {
      setPopoverCoords({
        top: rect.bottom + 5,
        left,
        width,
        maxHeight: Math.min(240, Math.max(110, spaceBelow)),
        openUpward: false
      });
    }
  }, [options.length]);

  const closeSelect = () => {
    if (isClosing || !isOpen) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsOpen(false);
    }, 160);
  };

  const toggleSelect = () => {
    if (isOpen) {
      closeSelect();
    } else {
      updatePopoverPosition();
      setIsOpen(true);
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePopoverPosition();
    }
  }, [isOpen, updatePopoverPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const inTrigger = containerRef.current && containerRef.current.contains(target);
      const inPopover = popoverRef.current && popoverRef.current.contains(target);
      if (!inTrigger && !inPopover) {
        closeSelect();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSelect();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', updatePopoverPosition);
      window.addEventListener('scroll', updatePopoverPosition, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [isOpen, isClosing, updatePopoverPosition]);

  const handleSelect = (val: T, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(val);
    closeSelect();
  };

  return (
    <div
      ref={containerRef}
      className={`acrylic-select-container ${className}`}
      style={style}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          toggleSelect();
        }}
        className={`acrylic-select-trigger ${isOpen ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
          {selectedOption?.dotColor && (
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: selectedOption.dotColor,
                display: 'inline-block',
                flexShrink: 0
              }}
            />
          )}
          {selectedOption?.icon && (
            <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          size={15}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s ease',
            flexShrink: 0,
            opacity: 0.75
          }}
        />
      </button>

      {(isOpen || isClosing) && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          className={`acrylic-select-popover ${isClosing ? 'closing' : ''}`}
          style={{
            position: 'fixed',
            top: popoverCoords.top !== undefined ? `${popoverCoords.top}px` : 'auto',
            bottom: popoverCoords.bottom !== undefined ? `${popoverCoords.bottom}px` : 'auto',
            left: `${popoverCoords.left}px`,
            right: 'auto',
            width: `${popoverCoords.width}px`,
            maxHeight: `${popoverCoords.maxHeight}px`,
            zIndex: 10090,
            transformOrigin: popoverCoords.openUpward ? 'bottom center' : 'top center'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={(e) => handleSelect(opt.value, e)}
                className={`acrylic-select-option ${isSelected ? 'is-selected' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {opt.dotColor && (
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: opt.dotColor,
                        display: 'inline-block',
                        flexShrink: 0
                      }}
                    />
                  )}
                  {opt.icon && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                      {opt.icon}
                    </span>
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                </div>

                {isSelected && (
                  <Check
                    size={14}
                    color="var(--accent-primary)"
                    strokeWidth={2.4}
                    style={{ flexShrink: 0 }}
                  />
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

export default CustomSelect;
