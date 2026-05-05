import type { ReservationWithUser } from '@/types/reservation';

export interface ScheduleXEvent {
  id: number;
  title: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  description?: string;
  people?: string[];
}

const toZoned = (iso: string): Temporal.ZonedDateTime =>
  Temporal.Instant.from(iso).toZonedDateTimeISO(Temporal.Now.timeZoneId());

export const toScheduleXEvent = (
  reservation: ReservationWithUser,
): ScheduleXEvent => ({
  id: reservation.id,
  title: reservation.user_name || reservation.title,
  start: toZoned(reservation.start_time),
  end: toZoned(reservation.end_time),
  description: reservation.title,
  people: reservation.user_name ? [reservation.user_name] : undefined,
});
