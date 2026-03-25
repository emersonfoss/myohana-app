import { db } from "./storage";
import {
  families, familyMembers, messages, vaultDocuments, mediaItems, calendarEvents, locations, subscriptions, chatMessages
} from "@shared/schema";

export async function seedDatabase() {
  // Check if the family already exists
  const existingFamily = db.select().from(families).get();
  if (existingFamily) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with Foss family data...");

  // Create the family
  const family = db.insert(families).values({
    name: "The Foss Family",
  }).returning().get();

  // Create family members
  const dad = db.insert(familyMembers).values({
    familyId: family.id,
    name: "Dad",
    role: "dad",
    age: 42,
    emoji: "👨‍💻",
    description: "The Builder. Dreamer, night owl, driven by love.",
  }).returning().get();

  const mom = db.insert(familyMembers).values({
    familyId: family.id,
    name: "Kristina",
    role: "mom",
    emoji: "💐",
    description: "The Heart. Keeps everything spinning with grace.",
  }).returning().get();

  const scarlett = db.insert(familyMembers).values({
    familyId: family.id,
    name: "Scarlett Rayne",
    role: "child",
    age: 6,
    emoji: "🦋",
    description: "The Explorer. Asks why about everything.",
  }).returning().get();

  const emmy = db.insert(familyMembers).values({
    familyId: family.id,
    name: "Emilia Rayne",
    role: "child",
    age: 5,
    emoji: "🌻",
    description: "The Sunshine. Her laugh fills the house.",
  }).returning().get();

  const baby = db.insert(familyMembers).values({
    familyId: family.id,
    name: "John Barron Emerson",
    role: "baby",
    age: 0,
    emoji: "👶",
    description: "The Newest Foss. Big eyes, tiny fingers.",
  }).returning().get();

  // Seed messages
  db.insert(messages).values({
    familyId: family.id,
    authorId: dad.id,
    title: "A Message to My Family",
    content: `It's 1 AM and the house is quiet. The kind of quiet that makes you think too loud. I'm sitting here, looking at the monitor glow, and all I can think about is you.\n\nScarlett, you asked me today why the sky changes colors. Emmy, you made me laugh so hard at dinner I almost cried. Baby John, you grabbed my finger and didn't let go. Kristina, you held everything together today like you always do — and you made it look effortless.\n\nI'm building this for us. Not because we need another app — but because I never want to forget these moments. Every laugh, every "why," every tiny grip on my finger. This is our place. Our ohana. Nobody gets left behind or forgotten.`,
    type: "text",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  }).run();

  db.insert(messages).values({
    familyId: family.id,
    authorId: dad.id,
    recipientId: scarlett.id,
    title: "Thinking about you, explorer",
    content: "You asked me today why birds can fly and we can't. I didn't have a great answer. But I love that you asked. Never stop asking why, Scarlett. The world needs more people who wonder.",
    type: "rose",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  }).run();

  db.insert(messages).values({
    familyId: family.id,
    authorId: dad.id,
    recipientId: emmy.id,
    title: "Your laugh is everything",
    content: "Emmy, your laugh today at the dinner table — the one where you couldn't stop and it turned into hiccups — that's the sound I want to remember forever. You light up every room, sunshine.",
    type: "rose",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  }).run();

  db.insert(messages).values({
    familyId: family.id,
    authorId: dad.id,
    title: "Rose & Thorn: Today",
    content: "Rose: Emmy said 'I love you to the moon and back and around again.' Thorn: Didn't get to read bedtime stories tonight because of work. Tomorrow I will.",
    type: "thorn",
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  }).run();

  // Seed vault documents
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  db.insert(vaultDocuments).values({
    familyId: family.id,
    uploadedById: dad.id,
    name: "Family Health Insurance",
    category: "insurance",
    description: "BlueCross BlueShield family plan - Policy #FH-20250101",
    expiresAt: sixMonthsFromNow.toISOString(),
  }).run();

  db.insert(vaultDocuments).values({
    familyId: family.id,
    uploadedById: mom.id,
    name: "Scarlett Birth Certificate",
    category: "identity",
    description: "State of record birth certificate for Scarlett Rayne Foss",
  }).run();

  db.insert(vaultDocuments).values({
    familyId: family.id,
    uploadedById: dad.id,
    name: "Family Trust",
    category: "legal",
    description: "Foss Family Revocable Living Trust - established 2024",
  }).run();

  // Seed media items
  db.insert(mediaItems).values({
    familyId: family.id,
    addedById: dad.id,
    title: "Baby Shark",
    url: "https://youtube.com/watch?v=XqZsoesa55w",
    type: "youtube",
    approvedForAges: JSON.stringify(["all"]),
  }).run();

  db.insert(mediaItems).values({
    familyId: family.id,
    addedById: mom.id,
    title: "Sesame Street ABCs",
    url: "https://youtube.com/watch?v=PR5GDm-IT8c",
    type: "youtube",
    approvedForAges: JSON.stringify(["all"]),
  }).run();

  db.insert(mediaItems).values({
    familyId: family.id,
    addedById: dad.id,
    title: "Magic School Bus",
    url: "https://youtube.com/watch?v=v53mhRXXT2g",
    type: "youtube",
    approvedForAges: JSON.stringify(["5+"]),
  }).run();

  // Seed a few calendar events
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 3);

  db.insert(calendarEvents).values({
    familyId: family.id,
    title: "Scarlett's Soccer Practice",
    description: "Weekly practice at the rec center",
    startDate: nextWeek.toISOString(),
    location: "Community Rec Center",
    memberIds: JSON.stringify([scarlett.id]),
    source: "manual",
  }).run();

  const nextWeek2 = new Date(today);
  nextWeek2.setDate(nextWeek2.getDate() + 5);

  db.insert(calendarEvents).values({
    familyId: family.id,
    title: "Family Movie Night",
    description: "Pick a movie everyone agrees on (impossible but fun)",
    startDate: nextWeek2.toISOString(),
    memberIds: JSON.stringify([dad.id, mom.id, scarlett.id, emmy.id, baby.id]),
    source: "manual",
  }).run();

  // Seed locations for Family Pulse
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const twentyMinAgo = new Date(now.getTime() - 20 * 60 * 1000).toISOString();

  db.insert(locations).values({
    familyId: family.id,
    memberId: dad.id,
    latitude: "40.7128",
    longitude: "-74.0060",
    address: "Home — New York",
    updatedAt: fiveMinAgo,
  }).run();

  db.insert(locations).values({
    familyId: family.id,
    memberId: mom.id,
    latitude: "40.7128",
    longitude: "-74.0060",
    address: "Home — New York",
    updatedAt: tenMinAgo,
  }).run();

  db.insert(locations).values({
    familyId: family.id,
    memberId: scarlett.id,
    latitude: "40.7580",
    longitude: "-73.9855",
    address: "School — Midtown",
    updatedAt: twentyMinAgo,
  }).run();

  db.insert(locations).values({
    familyId: family.id,
    memberId: emmy.id,
    latitude: "40.7580",
    longitude: "-73.9855",
    address: "School — Midtown",
    updatedAt: twentyMinAgo,
  }).run();

  db.insert(locations).values({
    familyId: family.id,
    memberId: baby.id,
    latitude: "40.7128",
    longitude: "-74.0060",
    address: "Home — New York",
    updatedAt: fiveMinAgo,
  }).run();

  // Seed subscription for the Foss family
  const subStart = new Date();
  const nextMonth = new Date(subStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  db.insert(subscriptions).values({
    familyId: family.id,
    status: "active",
    plan: "family",
    priceMonthly: 1999,
    startedAt: subStart.toISOString(),
    expiresAt: nextMonth.toISOString(),
    stripeCustomerId: "mock_cus_1",
    stripeSubscriptionId: "mock_sub_1",
  }).run();

  // Seed chat messages
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  db.insert(chatMessages).values({
    familyId: family.id,
    senderName: "Kristina",
    platform: "whatsapp",
    content: "Can you pick up Scarlett from school today?",
    createdAt: new Date(twoHoursAgo.getTime()).toISOString(),
  }).run();

  db.insert(chatMessages).values({
    familyId: family.id,
    senderName: "Dad",
    platform: "whatsapp",
    content: "On it! What time?",
    createdAt: new Date(twoHoursAgo.getTime() + 2 * 60 * 1000).toISOString(),
  }).run();

  db.insert(chatMessages).values({
    familyId: family.id,
    senderName: "Kristina",
    platform: "whatsapp",
    content: "3:15. She has soccer practice until then",
    createdAt: new Date(twoHoursAgo.getTime() + 4 * 60 * 1000).toISOString(),
  }).run();

  db.insert(chatMessages).values({
    familyId: family.id,
    senderName: "Dad",
    platform: "whatsapp",
    content: "👍 I'll be there",
    createdAt: new Date(twoHoursAgo.getTime() + 5 * 60 * 1000).toISOString(),
  }).run();

  db.insert(chatMessages).values({
    familyId: family.id,
    senderName: "Scarlett",
    platform: "internal",
    content: "Daddy I made a painting for you!",
    createdAt: new Date(twoHoursAgo.getTime() + 60 * 60 * 1000).toISOString(),
  }).run();

  console.log("Database seeded successfully!");
}
