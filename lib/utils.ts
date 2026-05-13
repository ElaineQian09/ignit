export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function splitToList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatDate(value: string | null) {
  if (!value) {
    return "No deadline";
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatDurationMinutes(value: number | null | undefined) {
  if (!value || value <= 0) {
    return null;
  }

  if (value < 60) {
    return `${value} min`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function daysRemainingLabel(value: string | null) {
  if (!value) {
    return "No deadline";
  }

  const deadline = new Date(value);
  const today = new Date();
  deadline.setHours(23, 59, 59, 999);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`;
  }

  if (diffDays === 0) {
    return "Due today";
  }

  return `${diffDays} day${diffDays === 1 ? "" : "s"} left`;
}

export function isSameLocalDay(left: string | Date, right: string | Date) {
  const leftDate = left instanceof Date ? left : new Date(left);
  const rightDate = right instanceof Date ? right : new Date(right);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

export function safeInternalPath(path: string | null) {
  if (!path || !path.startsWith("/")) {
    return "/dashboard";
  }

  return path;
}
