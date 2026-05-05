'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react';
import {
  createViewDay,
  createViewMonthGrid,
  createViewWeek,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls';
import '@schedule-x/theme-default/dist/index.css';

import { fetchReservationsByWeek } from '@/lib/api/reservationsByWeek';
import { toScheduleXEvent } from '@/lib/calendar/toScheduleXEvent';

type ViewKind = 'month' | 'week' | 'day';

interface ReservationCalendarProps {
  currentView: ViewKind;
  currentDate: Date;
  refreshKey: number;
  onDateClick: (date: Date) => void;
  onNewReservation: () => void;
}

const VIEW_NAME: Record<ViewKind, string> = {
  month: 'month-grid',
  week: 'week',
  day: 'day',
};

const toPlainDate = (date: Date): Temporal.PlainDate =>
  Temporal.PlainDate.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });

const BUSINESS_START_HOUR = 9;

// セル高さから 1 日に表示する予約件数を算出するためのレイアウト定数。
// SCSS の sx__month-grid-event / grid-gap と揃える。セルの上下パディングと
// ヘッダー高さは DOM から実測する。
const MONTH_CELL_EVENT_HEIGHT = 24;
const MONTH_CELL_EVENT_GAP = 2;
const MONTH_CELL_HEADER_FALLBACK = 40;
const MONTH_CELL_PADDING_FALLBACK = 16;
const MONTH_CELL_MIN_EVENTS = 1;
const MONTH_CELL_MAX_EVENTS = 8;
const DEFAULT_EVENTS_PER_DAY = 3;

const computeEventsPerDay = (
  cellHeight: number,
  headerHeight: number,
  paddingY: number,
): number => {
  if (!Number.isFinite(cellHeight) || cellHeight <= 0) {
    return DEFAULT_EVENTS_PER_DAY;
  }
  // "..." (+ N events) インジケータはセル下端のパディング内に収まる前提とし
  // 控除しない。控除するとセル高が小さい環境で 1 件しか表示できなくなり、
  // ロード直後に予約内容がほぼ見えなくなるため。
  const available = cellHeight - headerHeight - paddingY;
  const slot = MONTH_CELL_EVENT_HEIGHT + MONTH_CELL_EVENT_GAP;
  const raw = Math.floor((available + MONTH_CELL_EVENT_GAP) / slot);
  return Math.min(MONTH_CELL_MAX_EVENTS, Math.max(MONTH_CELL_MIN_EVENTS, raw));
};

const plainDateToJSDate = (pd: Temporal.PlainDate): Date =>
  new Date(pd.year, pd.month - 1, pd.day, BUSINESS_START_HOUR, 0, 0, 0);

const zonedToJSDate = (zdt: Temporal.ZonedDateTime): Date => {
  const pd = zdt.toPlainDate();
  return new Date(pd.year, pd.month - 1, pd.day, zdt.hour, 0, 0, 0);
};

const formatYmd = (zdt: Temporal.ZonedDateTime): string => {
  const pd = zdt.toPlainDate();
  return `${pd.year}-${String(pd.month).padStart(2, '0')}-${String(pd.day).padStart(2, '0')}`;
};

const ReservationCalendar = ({
  currentView,
  currentDate,
  refreshKey,
  onDateClick,
  onNewReservation,
}: ReservationCalendarProps) => {
  const eventsService = useMemo(() => createEventsServicePlugin(), []);
  const calendarControls = useMemo(() => createCalendarControlsPlugin(), []);
  const rangeRef = useRef<{ start: string; end: string } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [nEventsPerDay, setNEventsPerDay] = useState(DEFAULT_EVENTS_PER_DAY);

  const loadEvents = async (start: string, end: string) => {
    try {
      const reservations = await fetchReservationsByWeek(start, end);
      eventsService.set(reservations.map(toScheduleXEvent));
    } catch (error) {
      console.error('予約データの取得に失敗しました:', error);
      eventsService.set([]);
    }
  };

  const calendar = useNextCalendarApp(
    {
      views: [createViewMonthGrid(), createViewWeek(), createViewDay()],
      defaultView: VIEW_NAME[currentView],
      selectedDate: toPlainDate(currentDate),
      locale: 'ja-JP',
      firstDayOfWeek: 7,
      timezone: Temporal.Now.timeZoneId(),
      dayBoundaries: { start: '09:00', end: '22:00' },
      monthGridOptions: {
        nEventsPerDay,
      },
      translations: {
        'ja-JP': {
          '+ {{n}} events': '...',
          '+ 1 event': '...',
          Today: '今日',
        },
      },
      events: [],
      callbacks: {
        onRangeUpdate: (range) => {
          const start = formatYmd(range.start);
          const end = formatYmd(range.end);
          rangeRef.current = { start, end };
          loadEvents(start, end);
        },
        onClickDate: (date) => {
          onDateClick(plainDateToJSDate(date));
        },
        onClickDateTime: (dateTime) => {
          onDateClick(zonedToJSDate(dateTime));
        },
      },
    },
    [eventsService, calendarControls, nEventsPerDay],
  );

  // Sync external view changes (header buttons) into Schedule-X.
  useEffect(() => {
    if (!calendar) return;
    calendarControls.setView(VIEW_NAME[currentView]);
  }, [calendar, calendarControls, currentView]);

  // Sync external date changes (CalendarNavigation) into Schedule-X.
  useEffect(() => {
    if (!calendar) return;
    calendarControls.setDate(toPlainDate(currentDate));
  }, [calendar, calendarControls, currentDate]);

  // Refetch after a reservation mutation. onRangeUpdate already handles initial load.
  useEffect(() => {
    if (refreshKey === 0 || !rangeRef.current) return;
    loadEvents(rangeRef.current.start, rangeRef.current.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // 月セルの高さに応じて 1 日に表示する予約件数を更新する。
  useEffect(() => {
    if (currentView !== 'month') return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let frame = 0;
    const measure = () => {
      const cell = wrapper.querySelector<HTMLElement>('.sx__month-grid-day');
      if (!cell) return;
      const header = cell.querySelector<HTMLElement>(
        '.sx__month-grid-day__header',
      );
      const cellStyle = window.getComputedStyle(cell);
      const paddingY =
        (parseFloat(cellStyle.paddingTop) || 0) +
          (parseFloat(cellStyle.paddingBottom) || 0) ||
        MONTH_CELL_PADDING_FALLBACK;
      const headerHeight = header?.offsetHeight || MONTH_CELL_HEADER_FALLBACK;
      const next = computeEventsPerDay(
        cell.clientHeight,
        headerHeight,
        paddingY,
      );
      setNEventsPerDay((prev) => (prev === next ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(wrapper);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [calendar, currentView]);

  const HeaderNewReservationButton = () => (
    <button
      type="button"
      className="sx__custom-new-reservation"
      onClick={onNewReservation}
    >
      新規予約
    </button>
  );

  return (
    <div ref={wrapperRef} style={{ height: '100%' }}>
      <ScheduleXCalendar
        calendarApp={calendar}
        customComponents={{
          headerContentLeftAppend: HeaderNewReservationButton,
        }}
      />
    </div>
  );
};

export default ReservationCalendar;
