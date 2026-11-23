export const HOUR_MS = 3_600_000;
export const SCHEDULE_STORAGE_KEY = "fr3d-print-schedule-v1";

export type PrintJob = { id: string; productName: string; durationMinutes: number; notes: string };
export type PrinterQueue = { printerId: string; name: string; startAt: number; jobs: PrintJob[] };
export type PrintSchedule = { version: 1; queues: PrinterQueue[] };
export type ScheduledPrintJob = PrintJob & { order: number; startAt: number; endAt: number };

/** Durations are elapsed minutes: nights, weekends and date boundaries do not interrupt a job. */
export function parseDuration(value: string): number | null {
  const text = value.trim().toLowerCase().replace(/,/g, ".").replace(/\be\b/g, " ").replace(/\s+/g, " ");
  if (!text) return null;
  let minutes = 0;
  if (/^\d+(?:\.\d+)?$/.test(text)) minutes = Number(text) * 60;
  else {
    const tokens = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(dias?|days?|d|horas?|hours?|h|minutos?|minutes?|min|m)\b/g));
    const rest = text.replace(/(\d+(?:\.\d+)?)\s*(dias?|days?|d|horas?|hours?|h|minutos?|minutes?|min|m)\b/g, "").trim();
    if (!tokens.length || rest) return null;
    minutes = tokens.reduce((sum, match) => sum + Number(match[1]) * (match[2].startsWith("d") ? 1440 : match[2].startsWith("h") ? 60 : 1), 0);
  }
  const rounded = Math.round(minutes);
  return Number.isFinite(rounded) && rounded > 0 && rounded <= 5_256_000 ? rounded : null;
}

export function formatDuration(minutes: number, abbreviated = false): string {
  const value = Math.max(0, Math.round(minutes));
  const days = Math.floor(value / 1440);
  const hours = Math.floor((value % 1440) / 60);
  const remainder = value % 60;
  const parts: string[] = [];
  if (days) parts.push(abbreviated ? `${days}d` : `${days} ${days === 1 ? "dia" : "dias"}`);
  if (hours) parts.push(abbreviated ? `${hours}h` : `${hours} ${hours === 1 ? "hora" : "horas"}`);
  if (remainder || !parts.length) parts.push(abbreviated ? `${remainder}min` : `${remainder} ${remainder === 1 ? "minuto" : "minutos"}`);
  return parts.join(abbreviated ? " " : " e ");
}

/** Dates are derived, never individually persisted, preventing overlaps and stale successors. */
export function calculateQueue(queue: PrinterQueue): ScheduledPrintJob[] {
  let cursor = queue.startAt;
  return queue.jobs.map((job, index) => {
    const startAt = cursor;
    const endAt = startAt + job.durationMinutes * 60_000;
    cursor = endAt;
    return { ...job, order: index + 1, startAt, endAt };
  });
}

export function moveJob(schedule: PrintSchedule, jobId: string, targetPrinterId: string, position: number): PrintSchedule {
  const job = schedule.queues.flatMap(queue => queue.jobs).find(item => item.id === jobId);
  if (!job || !schedule.queues.some(queue => queue.printerId === targetPrinterId)) return schedule;
  return { ...schedule, queues: schedule.queues.map(queue => {
    const jobs = queue.jobs.filter(item => item.id !== jobId);
    if (queue.printerId === targetPrinterId) jobs.splice(Math.max(0, Math.min(jobs.length, Math.floor(position))), 0, job);
    return { ...queue, jobs };
  }) };
}

export function createSchedule(now = Date.now()): PrintSchedule {
  const startAt = Math.ceil(now / 60_000) * 60_000;
  return { version: 1, queues: [
    { printerId: "a1", name: "A1", startAt, jobs: [] },
    { printerId: "p1s", name: "P1S", startAt, jobs: [] },
  ] };
}

export function isPrintSchedule(value: unknown): value is PrintSchedule {
  if (!value || typeof value !== "object") return false;
  const schedule = value as PrintSchedule;
  if (schedule.version !== 1 || !Array.isArray(schedule.queues) || schedule.queues.length !== 2) return false;
  const ids = new Set<string>();
  const printerIds = new Set<string>();
  return schedule.queues.every(queue => {
    if (!queue || !["a1", "p1s"].includes(queue.printerId) || printerIds.has(queue.printerId) || typeof queue.name !== "string" || !Number.isFinite(queue.startAt) || queue.startAt < 0 || queue.startAt > 8_000_000_000_000_000 || !Array.isArray(queue.jobs) || queue.jobs.length > 5000) return false;
    printerIds.add(queue.printerId);
    return queue.jobs.every(job => {
      if (!job || typeof job.id !== "string" || !job.id || ids.has(job.id) || typeof job.productName !== "string" || !job.productName.trim() || job.productName.length > 200 || !Number.isInteger(job.durationMinutes) || job.durationMinutes <= 0 || job.durationMinutes > 5_256_000 || typeof job.notes !== "string" || job.notes.length > 2000) return false;
      ids.add(job.id);
      return true;
    });
  });
}

export function toLocalDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
