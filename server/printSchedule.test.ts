import { describe, expect, it } from "vitest";
import { calculateQueue, createSchedule, formatDuration, isPrintSchedule, moveJob, parseDuration, toLocalDateTime, type PrintJob } from "../shared/printSchedule";

const job = (id: string, durationMinutes: number): PrintJob => ({ id, productName: `Produto ${id}`, durationMinutes, notes: "PLA rosa" });
const base = Date.UTC(2026, 10, 23, 11);

function fixture() {
  const schedule = createSchedule(base);
  schedule.queues[0].jobs = [job("first", 1680), job("second", 150), job("third", 60)];
  schedule.queues[1].jobs = [job("other", 30)];
  return schedule;
}

describe("print schedule duration", () => {
  it.each([["28", 1680], ["28h", 1680], ["28 horas", 1680], ["1d 4h", 1680], ["1 dia e 4 horas", 1680], ["2,5", 150], ["2h 30min", 150], ["90 minutos", 90], ["0.5h", 30], ["2 dias 4 horas e 10 minutos", 3130]])("parses %s as elapsed minutes", (text, expected) => expect(parseDuration(String(text))).toBe(expected));
  it.each(["", "0", "-2", "NaN", "28h texto", "0.00001", "1:30", "1e3", "99999999", "--5h"])("rejects invalid duration %s", text => expect(parseDuration(text)).toBeNull());
  it("formats the requested 28-hour example", () => {
    expect(formatDuration(1680)).toBe("1 dia e 4 horas");
    expect(formatDuration(1680, true)).toBe("1d 4h");
    expect(formatDuration(150)).toBe("2 horas e 30 minutos");
    expect(formatDuration(0, true)).toBe("0min");
  });
});

describe("print schedule chaining", () => {
  it("crosses midnight with uninterrupted elapsed hours", () => {
    const results = calculateQueue(fixture().queues[0]);
    expect(results[0].startAt).toBe(base);
    expect(results[0].endAt).toBe(base + 28 * 3_600_000);
    expect(results[1].startAt).toBe(results[0].endAt);
    expect(results[2].startAt).toBe(results[1].endAt);
    expect(results.map(result => result.order)).toEqual([1, 2, 3]);
  });
  it("crosses weekends, month and year boundaries", () => {
    const schedule = fixture();
    schedule.queues[0].startAt = Date.UTC(2026, 11, 31, 23);
    expect(new Date(calculateQueue(schedule.queues[0])[0].endAt).toISOString()).toBe("2027-01-02T03:00:00.000Z");
  });
  it("recalculates all successors when duration changes", () => {
    const schedule = fixture();
    schedule.queues[0].jobs[0].durationMinutes = 60;
    expect(calculateQueue(schedule.queues[0])[1].startAt).toBe(base + 3_600_000);
  });
  it("changing base shifts the entire queue without affecting another printer", () => {
    const schedule = fixture();
    schedule.queues[0].startAt += 3_600_000;
    expect(calculateQueue(schedule.queues[0])[0].startAt).toBe(base + 3_600_000);
    expect(calculateQueue(schedule.queues[1])[0].startAt).toBe(base);
  });
  it("reorders up and down and automatically chains the new order", () => {
    const moved = moveJob(fixture(), "third", "a1", 0);
    expect(moved.queues[0].jobs.map(item => item.id)).toEqual(["third", "first", "second"]);
    expect(calculateQueue(moved.queues[0])[1].startAt).toBe(base + 3_600_000);
    expect(moveJob(moved, "third", "a1", 2).queues[0].jobs.map(item => item.id)).toEqual(["first", "second", "third"]);
  });
  it("transfers jobs across printers and recalculates both queues", () => {
    const schedule = moveJob(fixture(), "first", "p1s", 1);
    expect(schedule.queues[0].jobs.map(item => item.id)).toEqual(["second", "third"]);
    expect(schedule.queues[1].jobs.map(item => item.id)).toEqual(["other", "first"]);
    expect(calculateQueue(schedule.queues[0])[1].startAt).toBe(base + 150 * 60_000);
    expect(calculateQueue(schedule.queues[1])[1].startAt).toBe(base + 30 * 60_000);
  });
  it("removal closes gaps", () => {
    const schedule = fixture();
    schedule.queues[0].jobs.splice(1, 1);
    const results = calculateQueue(schedule.queues[0]);
    expect(results[1].startAt).toBe(results[0].endAt);
    expect(results[1].order).toBe(2);
  });
  it("does not mutate its source and ignores unknown jobs and printers", () => {
    const schedule = fixture();
    const before = JSON.stringify(schedule);
    moveJob(schedule, "first", "a1", 999);
    expect(JSON.stringify(schedule)).toBe(before);
    expect(moveJob(schedule, "missing", "a1", 0)).toBe(schedule);
    expect(moveJob(schedule, "first", "missing", 0)).toBe(schedule);
  });
  it("handles empty queues", () => expect(calculateQueue(createSchedule(base).queues[0])).toEqual([]));
});

describe("print schedule persistence", () => {
  it("accepts valid backups and preserves timestamps and notes", () => {
    const parsed = JSON.parse(JSON.stringify(fixture()));
    expect(isPrintSchedule(parsed)).toBe(true);
    expect(parsed.queues[0].jobs[0].notes).toBe("PLA rosa");
    expect(parsed.queues[0].startAt).toBe(base);
  });
  it("rejects invalid backups", () => {
    expect(isPrintSchedule(null)).toBe(false);
    expect(isPrintSchedule({ version: 1, queues: [] })).toBe(false);
    const negative = fixture(); negative.queues[0].jobs[0].durationMinutes = -30;
    expect(isPrintSchedule(negative)).toBe(false);
    const duplicates = fixture(); duplicates.queues[1].jobs[0].id = "first";
    expect(isPrintSchedule(duplicates)).toBe(false);
    const duplicatePrinters = fixture(); duplicatePrinters.queues[1].printerId = "a1";
    expect(isPrintSchedule(duplicatePrinters)).toBe(false);
  });
  it("converts UTC timestamps to a reversible local datetime input", () => {
    expect(new Date(toLocalDateTime(base)).getTime()).toBe(base);
  });
});
