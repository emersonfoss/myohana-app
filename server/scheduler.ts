// server/scheduler.ts
// Lightweight job scheduler — runs on server startup
// Jobs are stored in SQLite; polling every 5 minutes

import { storage } from "./storage";
import { memoryEngine, generateLLMNarrative } from "./memory-engine";
import * as llm from "./llm";
import { logger } from "./logger";
import type { ScheduledJob, MemoryAtom, FamilyMember } from "@shared/schema";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function startScheduler(): Promise<void> {
  // Reset any stale "running" jobs from a previous crash
  await storage.resetStaleRunningJobs();

  // Schedule next jobs for all families at startup
  await scheduleUpcomingJobs();

  // Poll every 5 minutes for due jobs
  setInterval(async () => {
    try {
      await runDueJobs();
      await scheduleUpcomingJobs();
    } catch (err) {
      logger.error({ err }, "[Scheduler] Poll cycle error");
    }
  }, POLL_INTERVAL);

  logger.info("[Scheduler] Started");
}

// ─── Schedule upcoming jobs ──────────────────────────────────────────

async function scheduleUpcomingJobs(): Promise<void> {
  const family = await storage.getFamily();
  if (!family) return;

  // Single-family app — schedule for the one family
  await ensureWeeklyCompilationScheduled(family.id);
  await ensureMonthlyCompilationScheduled(family.id);
  await ensureBirthdayCompilationsScheduled(family.id);
  await ensureOnThisDayScheduled(family.id);
}

async function ensureWeeklyCompilationScheduled(familyId: number): Promise<void> {
  const existing = await storage.getPendingJobsByType(familyId, "weekly_compilation");
  if (existing.length > 0) return;

  const nextSunday = getNextSunday();
  await storage.createScheduledJob({
    familyId,
    jobType: "weekly_compilation",
    scheduledFor: nextSunday.toISOString(),
    status: "pending",
  });
}

async function ensureMonthlyCompilationScheduled(familyId: number): Promise<void> {
  const existing = await storage.getPendingJobsByType(familyId, "monthly_compilation");
  if (existing.length > 0) return;

  const nextFirst = getNextFirstOfMonth();
  await storage.createScheduledJob({
    familyId,
    jobType: "monthly_compilation",
    scheduledFor: nextFirst.toISOString(),
    status: "pending",
  });
}

async function ensureBirthdayCompilationsScheduled(familyId: number): Promise<void> {
  const members = await storage.getFamilyMembers(familyId);

  for (const member of members) {
    if (!member.dateOfBirth) continue;

    const dob = new Date(member.dateOfBirth);
    const thisYear = new Date().getFullYear();
    const birthday = new Date(thisYear, dob.getMonth(), dob.getDate());

    // If birthday already passed this year, try next year
    if (birthday < new Date()) {
      birthday.setFullYear(thisYear + 1);
    }

    // Schedule 7 days before birthday
    const scheduledDate = new Date(birthday);
    scheduledDate.setDate(birthday.getDate() - 7);

    if (scheduledDate <= new Date()) continue; // Too late to schedule

    // Check if already scheduled for this member
    const existing = await storage.getPendingJobsByType(familyId, "birthday_compilation");
    const alreadyScheduled = existing.some(j => {
      try {
        const r = JSON.parse(j.result || "{}");
        return r.memberId === member.id;
      } catch { return false; }
    });
    if (alreadyScheduled) continue;

    await storage.createScheduledJob({
      familyId,
      jobType: "birthday_compilation",
      scheduledFor: scheduledDate.toISOString(),
      status: "pending",
      result: JSON.stringify({ memberId: member.id, memberName: member.name }),
    });
  }
}

async function ensureOnThisDayScheduled(familyId: number): Promise<void> {
  const existing = await storage.getPendingJobsByType(familyId, "on_this_day");
  if (existing.length > 0) return;

  // Schedule for tomorrow at 9am
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  await storage.createScheduledJob({
    familyId,
    jobType: "on_this_day",
    scheduledFor: tomorrow.toISOString(),
    status: "pending",
  });
}

// ─── Run due jobs ────────────────────────────────────────────────────

async function runDueJobs(): Promise<void> {
  const now = new Date().toISOString();
  const dueJobs = await storage.getPendingJobs(now);

  for (const job of dueJobs) {
    await runJob(job);
  }
}

async function runJob(job: ScheduledJob): Promise<void> {
  await storage.updateJobStatus(job.id, "running");

  try {
    switch (job.jobType) {
      case "weekly_compilation":
        await runWeeklyCompilation(job.familyId);
        break;
      case "monthly_compilation":
        await runMonthlyCompilation(job.familyId);
        break;
      case "birthday_compilation":
        await runBirthdayCompilation(job);
        break;
      case "on_this_day":
        await runOnThisDay(job.familyId);
        break;
      case "memory_suggestions":
        // Suggestions are generated on-demand via the API endpoint
        break;
    }

    await storage.updateJobStatus(job.id, "completed");
  } catch (error: any) {
    logger.error({ err: error, jobId: job.id, jobType: job.jobType }, "[Scheduler] Job failed");
    await storage.updateJobStatus(job.id, "failed", JSON.stringify({ error: String(error.message || error) }));
  }
}

// ─── Compilation runners ─────────────────────────────────────────────

async function runWeeklyCompilation(familyId: number): Promise<void> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStart = oneWeekAgo.toISOString();
  const weekEnd = now.toISOString();

  const atoms = await storage.getMemoryAtomsByDateRange(familyId, weekStart, weekEnd);
  if (atoms.length < 3) return; // Not enough content

  // Use memoryEngine which already handles LLM fallback
  await memoryEngine.generateWeeklyCompilation(familyId, weekStart, weekEnd);
}

async function runMonthlyCompilation(familyId: number): Promise<void> {
  const now = new Date();
  // Generate compilation for the previous month
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const start = prevMonth.toISOString();
  const end = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const atoms = await storage.getMemoryAtomsByDateRange(familyId, start, end);
  if (atoms.length < 3) return;

  await memoryEngine.generateMonthlyCompilation(
    familyId,
    monthNames[prevMonth.getMonth()],
    prevMonth.getFullYear(),
  );
}

async function runBirthdayCompilation(job: ScheduledJob): Promise<void> {
  const familyId = job.familyId;
  let memberName = "a family member";
  let memberId: number | undefined;

  try {
    const meta = JSON.parse(job.result || "{}");
    memberName = meta.memberName || memberName;
    memberId = meta.memberId;
  } catch {}

  // Get all atoms for this family — birthday compilations draw from the full history
  const atoms = await storage.getMemoryAtoms(familyId, { limit: 200 });

  // Filter atoms mentioning this member if we have their ID
  let relevantAtoms = atoms;
  if (memberId) {
    relevantAtoms = atoms.filter(a => {
      if (a.createdById === memberId) return true;
      try {
        const ids: number[] = JSON.parse(a.memberIds || "[]");
        return ids.includes(memberId!);
      } catch { return false; }
    });
    // Fall back to all atoms if member-specific is too sparse
    if (relevantAtoms.length < 3) relevantAtoms = atoms;
  }

  if (relevantAtoms.length < 1) return;

  const family = await storage.getFamilyById(familyId);
  const members = await storage.getFamilyMembers(familyId);
  if (!family) return;

  // Generate narrative — use LLM if configured, else template
  let narrative: string;
  if (llm.isLLMConfigured()) {
    try {
      const users = await storage.getUsersByFamily(familyId);
      const userId = users[0]?.id || 0;
      narrative = await generateLLMNarrative(familyId, userId, "birthday", relevantAtoms, {
        subjectName: memberName,
      });
    } catch (err: any) {
      logger.warn({ error: err.message }, "LLM birthday narrative failed, falling back to template");
      narrative = memoryEngine.generateNarrative(relevantAtoms, family, members, `${memberName}'s birthday`);
    }
  } else {
    narrative = memoryEngine.generateNarrative(relevantAtoms, family, members, `${memberName}'s birthday`);
  }

  const now = new Date();
  await storage.createMemoryCompilation({
    familyId,
    type: "birthday",
    title: `${memberName}'s Birthday Compilation`,
    narrative,
    coverAtomId: relevantAtoms.find(a => a.sourceType === "photo")?.id || null,
    atomIds: JSON.stringify(relevantAtoms.map(a => a.id)),
    perspectiveMemberId: memberId || null,
    periodStart: new Date(now.getFullYear(), 0, 1).toISOString(),
    periodEnd: now.toISOString(),
    generatedAt: now.toISOString(),
  });
}

async function runOnThisDay(familyId: number): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const atoms = await memoryEngine.getOnThisDay(familyId, today);

  if (atoms.length < 1) return;

  const family = await storage.getFamilyById(familyId);
  const members = await storage.getFamilyMembers(familyId);
  if (!family) return;

  let narrative: string;
  if (llm.isLLMConfigured()) {
    try {
      const users = await storage.getUsersByFamily(familyId);
      const userId = users[0]?.id || 0;
      narrative = await generateLLMNarrative(familyId, userId, "on_this_day", atoms, {});
    } catch (err: any) {
      logger.warn({ error: err.message }, "LLM on-this-day narrative failed, falling back to template");
      narrative = memoryEngine.generateNarrative(atoms, family, members, "this day in past years");
    }
  } else {
    narrative = memoryEngine.generateNarrative(atoms, family, members, "this day in past years");
  }

  const now = new Date();
  await storage.createMemoryCompilation({
    familyId,
    type: "on_this_day",
    title: `On This Day — ${now.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`,
    narrative,
    coverAtomId: atoms.find(a => a.sourceType === "photo")?.id || null,
    atomIds: JSON.stringify(atoms.map(a => a.id)),
    perspectiveMemberId: null,
    periodStart: now.toISOString(),
    periodEnd: now.toISOString(),
    generatedAt: now.toISOString(),
  });
}

// ─── Date helpers ────────────────────────────────────────────────────

function getNextSunday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSunday);
  next.setHours(8, 0, 0, 0); // 8am Sunday
  return next;
}

function getNextFirstOfMonth(): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  next.setHours(8, 0, 0, 0); // 8am on the 1st
  return next;
}
