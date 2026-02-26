const istDateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export function formatIST(date: Date | string): string {
  const parsedDate = typeof date === 'string' ? new Date(date) : date;

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Invalid date';
  }

  const parts = istDateTimeFormatter.formatToParts(parsedDate);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  const day = values.get('day') ?? '00';
  const month = values.get('month') ?? 'Jan';
  const year = values.get('year') ?? '1970';
  const hour = values.get('hour') ?? '12';
  const minute = values.get('minute') ?? '00';
  const dayPeriod = (values.get('dayPeriod') ?? 'AM').toUpperCase();

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}
