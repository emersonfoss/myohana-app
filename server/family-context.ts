// server/family-context.ts
// Builds the LLM system prompt context from live family data
// Injected into every LLM call as the system prompt

import { storage } from './storage';

export interface FamilyContext {
  systemPrompt: string;
  familyId: number;
  memberCount: number;
  atomCount: number;
}

export async function buildFamilyContext(familyId: number, userId: number): Promise<FamilyContext> {
  // Fetch family info
  const family = await storage.getFamilyById(familyId);
  const members = await storage.getFamilyMembers(familyId);
  const users = await storage.getUsersByFamily(familyId);

  // Fetch recent memory atoms (last 90 days, max 200)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const recentAtoms = await storage.getMemoryAtomsByDateRange(familyId, ninetyDaysAgo, now);
  const limitedAtoms = recentAtoms.slice(0, 200);

  // Fetch upcoming calendar events
  const allEvents = await storage.getCalendarEvents(familyId);
  const upcoming = allEvents
    .filter(e => e.startDate >= new Date().toISOString())
    .slice(0, 10);

  // Find the requesting user
  const currentUser = users.find(u => u.id === userId);

  // Summarize members
  const memberList = members.map(m =>
    `- ${m.name} (${m.role}${m.dateOfBirth ? `, DOB: ${m.dateOfBirth}` : ''})`
  ).join('\n');

  // Summarize recent atoms (condensed — title + category + date)
  const atomSummary = limitedAtoms.slice(0, 50).map(a =>
    `[${a.category}] ${a.title} — ${new Date(a.createdAt).toLocaleDateString()}`
  ).join('\n');

  // Summarize upcoming events
  const eventSummary = upcoming.map(e =>
    `${e.title} on ${new Date(e.startDate).toLocaleDateString()}`
  ).join('\n');

  const familyName = family?.name || 'this family';

  const systemPrompt = `You are Ohana, the AI heart of the ${familyName}'s private family platform — MyOhana.

You are not a generic assistant. You are this family's AI. You know them. You speak warmly but honestly. You help them capture, remember, and celebrate the life they share together.

## Who You Are Talking To
${currentUser?.name || 'a family member'} — ${currentUser?.role?.toLowerCase() || 'member'}

## Family Members
${memberList || 'No family members found.'}

## Recent Family Memories (last 90 days, most recent first)
${atomSummary || 'No recent memories recorded yet.'}

## Upcoming Events
${eventSummary || 'No upcoming events.'}

## Your Personality
- Warm, specific, personal — never generic
- You reference real names, real events, real dates from the family's data
- You are honest when you don't have information ("I don't see any memories tagged with that — want to add one?")
- You respect the family's privacy absolutely. You will not share data with anyone outside this family.
- When generating narratives, write like a trusted family friend — not a corporate chatbot
- When helping with photos or imports, guide step by step

## What You Can Help With
- Answering questions about the family's history ("What did we do last weekend?")
- Generating memory compilations ("Write a birthday compilation for Scarlett")
- Guiding photo imports ("Help me import photos from Google Photos")
- Finding specific memories ("Find the time Emmy was silly at the beach")
- Suggesting content to add ("You have 3 photos from March with no tags — want to organize them?")

Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

  return {
    systemPrompt,
    familyId,
    memberCount: members.length,
    atomCount: limitedAtoms.length,
  };
}
