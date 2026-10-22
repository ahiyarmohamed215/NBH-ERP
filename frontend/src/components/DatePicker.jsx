import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { dateRangePosition } from './DateRangePicker';
import './DateRangePicker.css';
import './PurchasingAppearance.css';

const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parse = value => new Date(`${value}T12:00:00`);
const formatDisplay = value => {
  if (!value) return '';
  const d = parse(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function DatePicker({
  value,
  onChange,
  label = '',
  required = false,
  disabled = false,
  placeholder = 'Select date',
  ariaLabel = 'Select date',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (value ? parse(value) : new Date()));
  const [position, setPosition] = useState({});
  const anchor = useRef(null);
  const popup = useRef(null);

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const next = dateRangePosition(
        rect,
        {
          width: viewport?.width || window.innerWidth,
          height: viewport?.height || window.innerHeight,
          left: viewport?.offsetLeft || 0,
          top: viewport?.offsetTop || 0,
        },
        popup.current?.getBoundingClientRect().height || 360,
        320
      );
      setPosition(previous =>
        Object.keys(next).every(k => previous[k] === next[k]) ? previous : next
      );
    };

    const outside = event => {
      if (!anchor.current?.contains(event.target) && !popup.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const escape = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        anchor.current?.focus();
      }
    };

    reposition();
    popup.current?.querySelector('[data-selected="true"], [data-today="true"], .date-range-day')?.focus();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reposition);
    if (popup.current) observer?.observe(popup.current);

    return () => {
      observer?.disconnect();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    const d = value ? parse(value) : new Date();
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setOpen(true);
  };

  const choose = dateStr => {
    onChange(dateStr);
    setOpen(false);
    anchor.current?.focus();
  };

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from(
    { length: Math.ceil((offset + dayCount) / 7) * 7 },
    (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1)
  );

  const todayStr = key(new Date());

  return (
    <div className={`date-picker-container ${className}`.trim()} style={{ width: '100%', position: 'relative' }}>
      {label && <label style={{ display: 'block', fontSize: 'var(--erp-text-body)', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>{label}</label>}
      <button
        ref={anchor}
        type="button"
        className={`date-picker-trigger erp-field ${className}`.trim()}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
      >
        <Calendar size={15} style={{ color: '#64748b', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value ? formatDisplay(value) : <span style={{ color: '#94a3b8' }}>{placeholder}</span>}
        </span>
      </button>

      {/* Hidden input for form compatibility without summoning native browser date popup */}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />

      {open &&
        createPortal(
          <div
            ref={popup}
            role="dialog"
            aria-label={label || 'Choose date'}
            className="date-range-popover purchasing-no-shadows"
            style={{ ...position, width: '320px' }}
          >
            <header>
              <div>
                <h3>{label || 'Select date'}</h3>
                <p aria-live="polite">
                  {value ? formatDisplay(value) : 'Click a date on the calendar'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close date picker"
                onClick={() => {
                  setOpen(false);
                  anchor.current?.focus();
                }}
              >
                <X size={16} />
              </button>
            </header>

            <div className="date-range-month">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft size={17} />
              </button>
              <strong>
                {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </strong>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="date-range-weekdays">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="date-range-days">
              {days.map(date => {
                const dateStr = key(date);
                const isSelected = value === dateStr;
                const isToday = dateStr === todayStr;
                const outsideMonth = date.getMonth() !== month.getMonth();
                return (
                  <button
                    key={dateStr}
                    type="button"
                    className={`date-range-day${outsideMonth ? ' outside-month' : ''}${isSelected ? ' endpoint' : ''}`}
                    aria-label={date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    aria-pressed={isSelected}
                    data-selected={isSelected}
                    data-today={isToday}
                    onClick={() => choose(dateStr)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <footer>
              <button
                type="button"
                onClick={() => choose(todayStr)}
              >
                Today
              </button>
              {!required && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                    anchor.current?.focus();
                  }}
                >
                  Clear date
                </button>
              )}
            </footer>
          </div>,
          document.body
        )}
    </div>
  );
}
