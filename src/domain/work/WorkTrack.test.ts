import { describe, expect, it } from "vitest";
import { completeRework, confirm, countWorkedDays, initialWorkTrack, recordDailySession, reportCompletion, requestRework, start } from "./WorkTrack";

describe("WorkTrack", () => {
  it("progresses waiting -> working -> reported -> confirmed", () => {
    const started = start(initialWorkTrack, { date: "2026-07-08", people: 2 });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.status).toBe("working");
    expect(started.value.startDate).toBe("2026-07-08");

    const reported = reportCompletion(started.value, {
      date: "2026-07-09",
      days: 2,
      people: 2,
      content: "くさび足場 組立完了",
      photoCount: 2,
    });
    expect(reported.ok).toBe(true);
    if (!reported.ok) return;
    expect(reported.value.status).toBe("reported");

    const confirmed = confirm(reported.value);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.status).toBe("confirmed");
  });

  it("routes through the rework loop before allowing confirmation again", () => {
    const started = start(initialWorkTrack, { date: "2026-07-08", people: 2 });
    if (!started.ok) throw started.error;
    const reported = reportCompletion(started.value, { date: "2026-07-09", days: 2, people: 2, content: "組立完了", photoCount: 1 });
    if (!reported.ok) throw reported.error;

    const rework = requestRework(reported.value, { text: "手すりの隙間を是正してください", requestedAt: "2026-07-10" });
    expect(rework.ok).toBe(true);
    if (!rework.ok) return;
    expect(rework.value.status).toBe("rework");

    expect(confirm(rework.value).ok).toBe(false);

    const done = completeRework(rework.value);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.status).toBe("reported");
    expect(done.value.rework?.text).toBe("手すりの隙間を是正してください");

    expect(confirm(done.value).ok).toBe(true);
  });

  it("rejects out-of-order transitions", () => {
    expect(confirm(initialWorkTrack).ok).toBe(false);
    expect(requestRework(initialWorkTrack, { text: "x", requestedAt: "2026-07-01" }).ok).toBe(false);
    const started = start(initialWorkTrack, { date: "2026-07-01", people: null });
    if (!started.ok) throw started.error;
    expect(start(started.value, { date: "2026-07-02", people: null }).ok).toBe(false);
  });

  it("records daily sessions without changing status, and counts unique worked days", () => {
    const started = start(initialWorkTrack, { date: "2026-07-08", people: 2 });
    if (!started.ok) throw started.error;
    const day1End = recordDailySession(started.value, { date: "2026-07-08", kind: "end", people: 2, note: "1〜2層まで架設" });
    if (!day1End.ok) throw day1End.error;
    expect(day1End.value.status).toBe("working");

    const day2Start = recordDailySession(day1End.value, { date: "2026-07-09", kind: "start", people: 2, note: null });
    if (!day2Start.ok) throw day2Start.error;

    expect(countWorkedDays(day2Start.value, "2026-07-09")).toBe(2);
  });
});
