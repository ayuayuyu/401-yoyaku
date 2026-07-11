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
  onDayDetails: (date: Date) => void;
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
  // 「他 N件」インジケータはセル下端のパディング内に収まる前提とし控除しない。
  // 控除するとセル高が小さい環境で 1 件しか表示できなくなり、ロード直後に
  // 予約内容がほぼ見えなくなるため。
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

// Schedule-X はカスタム translations を渡すと組み込み翻訳と「マージせず丸ごと置換」する
// (core 内部: `config.translations || builtinTranslations`)。さらにロケール照合は
// ハイフンを除去したキーで行う (`ja-JP` → `jaJP`)。このため:
//   - キーは必ず `jaJP` にする。`'ja-JP'` で渡すと言語が見つからず translate がキー文字列を
//     そのまま返し、ラベルが `+ {{n}} events` のまま ({{n}} も未補間) で表示される。
//   - 置換で他の日本語表示が英語キーに落ちないよう、組み込み jaJP 辞書を再掲して上書きする。
// 月セルの「表示しきれない件数」は Google カレンダー風に「他 N件」へ差し替える。
const JA_JP_TRANSLATIONS = {
  // date picker
  Date: '日付',
  'MM/DD/YYYY': '年/月/日',
  'Next month': '次の月',
  'Previous month': '前の月',
  'Choose Date': '日付を選択',
  // calendar
  Today: '今日',
  Month: '月',
  Week: '週',
  Day: '日',
  List: 'リスト',
  'Select View': 'ビューを選択',
  View: 'ビュー',
  'No events': '予約なし',
  'Next period': '次の期間',
  'Previous period': '前の期間',
  to: 'から',
  'Full day- and multiple day events': '終日および複数日イベント',
  'Link to {{n}} more events on {{date}}': '{{date}} の他 {{n}} 件の予約',
  'Link to 1 more event on {{date}}': '{{date}} の他 1 件の予約',
  CW: '週 {{week}}',
  // time picker
  Time: '時間',
  AM: '午前',
  PM: '午後',
  Cancel: 'キャンセル',
  OK: 'OK',
  'Select time': '時間を選択',
  // 月セルの「他 N件」インジケータ (表示上限を超えた予約数)。
  '+ {{n}} events': '他 {{n}} 件',
  '+ 1 event': '他 1 件',
};

const ReservationCalendar = ({
  currentView,
  currentDate,
  refreshKey,
  onDateClick,
  onDayDetails,
}: ReservationCalendarProps) => {
  const eventsService = useMemo(() => createEventsServicePlugin(), []);
  const calendarControls = useMemo(() => createCalendarControlsPlugin(), []);
  const rangeRef = useRef<{ start: string; end: string } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [nEventsPerDay, setNEventsPerDay] = useState(DEFAULT_EVENTS_PER_DAY);

  // カレンダー生成時の config に閉じ込めるコールバックは ref 越しに呼ぶ
  // (config はマウント時 1 回だけ生成され、最新の props を参照できないため)。
  const onDateClickRef = useRef(onDateClick);
  const onDayDetailsRef = useRef(onDayDetails);
  useEffect(() => {
    onDateClickRef.current = onDateClick;
    onDayDetailsRef.current = onDayDetails;
  }, [onDateClick, onDayDetails]);

  const fetchEventsForRange = async (start: string, end: string) => {
    try {
      const reservations = await fetchReservationsByWeek(start, end);
      return reservations.map(toScheduleXEvent);
    } catch (error) {
      console.error('予約データの取得に失敗しました:', error);
      return [];
    }
  };

  // 予約作成/編集後の手動リフェッチ用。mutation は range 変更を伴わず
  // fetchEvents が呼ばれないため、表示中の range を使って取り直し
  // eventsService で反映する。
  const loadEvents = async (start: string, end: string) => {
    eventsService.set(await fetchEventsForRange(start, end));
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
        jaJP: JA_JP_TRANSLATIONS,
      },
      events: [],
      callbacks: {
        // fetchEvents は onRangeUpdate と異なり「初回レンダー時にも」呼ばれる。
        // onRangeUpdate は内部の wasInitialized 判定で初回 range セット時は発火せず、
        // リロード直後の表示が空になっていた。range ベースの読み込みはこちらに一本化。
        fetchEvents: async (range) => {
          const start = formatYmd(range.start);
          const end = formatYmd(range.end);
          rangeRef.current = { start, end };
          return fetchEventsForRange(start, end);
        },
        // 月の日クリックはその日の詳細(日ビュー)へ。週/日の時間枠クリックは
        // 新規予約モーダルを開く。
        onClickDate: (date) => {
          onDayDetailsRef.current(plainDateToJSDate(date));
        },
        onClickDateTime: (dateTime) => {
          onDateClickRef.current(zonedToJSDate(dateTime));
        },
      },
    },
    [eventsService, calendarControls],
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

  // 算出した nEventsPerDay を月グリッドに反映する。useNextCalendarApp は
  // アプリを 1 度しか生成せず、monthGridOptions の公開 setter も無いため、
  // 内部 signal を直接更新して再生成・再フェッチなしに表示件数を変える。
  // (Schedule-X 4.x: 月グリッドは config.monthGridOptions.value を購読している)
  useEffect(() => {
    if (!calendar) return;
    const config = (
      calendar as unknown as {
        $app: {
          config: { monthGridOptions: { value: { nEventsPerDay: number } } };
        };
      }
    ).$app.config;
    config.monthGridOptions.value = {
      ...config.monthGridOptions.value,
      nEventsPerDay,
    };
  }, [calendar, nEventsPerDay]);

  // Refetch after a reservation mutation. fetchEvents already handles initial load.
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

  return (
    <div ref={wrapperRef} style={{ height: '100%' }}>
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
};

export default ReservationCalendar;
