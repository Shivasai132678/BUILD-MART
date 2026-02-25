const istDateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZoneName: 'short',
});

export function formatIST(date: Date | string): string {
  const parsedDate = typeof date === 'string' ? new Date(date) : date;

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Invalid date';
  }

  return istDateTimeFormatter.format(parsedDate);
}
