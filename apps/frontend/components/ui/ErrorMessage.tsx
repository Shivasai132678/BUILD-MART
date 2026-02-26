type ErrorMessageProps = {
  message?: string | null;
  className?: string;
};

export function ErrorMessage({ message, className = '' }: ErrorMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`.trim()}
    >
      {message}
    </div>
  );
}

