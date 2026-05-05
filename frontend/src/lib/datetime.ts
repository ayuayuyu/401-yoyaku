const pad2 = (value: number) => String(value).padStart(2, '0');

export const toDateInputValue = (value: Date): string => {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
};

export const toTimeInputValue = (value: Date): string => {
  return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
};

export const toDateTimeLocalInputValue = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  return `${toDateInputValue(date)}T${toTimeInputValue(date)}`;
};

const toTimezoneOffset = (value: Date): string => {
  const offsetMinutes = -value.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${pad2(hours)}:${pad2(minutes)}`;
};

export const toApiDateTime = (dateValue: string, timeValue: string): string => {
  const date = new Date(`${dateValue}T${timeValue}:00`);
  return `${dateValue}T${timeValue}:00${toTimezoneOffset(date)}`;
};

export const toApiDateTimeFromLocalInput = (value: string): string => {
  const date = new Date(value);
  const datePart = toDateInputValue(date);
  const timePart = toTimeInputValue(date);
  return `${datePart}T${timePart}:00${toTimezoneOffset(date)}`;
};

export const formatTimeRange = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${toTimeInputValue(startDate)} - ${toTimeInputValue(endDate)}`;
};
