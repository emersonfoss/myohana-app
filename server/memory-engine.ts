import { storage } from "./storage";
import type {
  Family, FamilyMember, Photo, Message, CalendarEvent,
  ThinkingOfYouPulse, ChatMessage, MemoryAtom, MemoryCompilation,
  InsertMemoryAtom, InsertMemoryCompilation,
} from "@shared/schema";

// ─── Category & Tone Inference ────────────────────────────────────────────

function inferCategory(sourceType: string, metadata: Record<string, unknown>): string {
  const text = [
    metadata.title as string || "",
    metadata.content as string || "",
    metadata.caption as string || "",
    metadata.description as string || "",
  ].join(" ").toLowerCase();

  if (/birthday|anniversary|wedding|graduation|promotion/.test(text)) return "celebration";
  if (/milestone|first time|first step|first word|first day|new born|born/.test(text)) return "milestone";
  if (/soccer|school|class|teacher|homework|practice|recital/.test(text)) return "school";
  if (/trip|vacation|travel|airport|hotel|beach|camping/.test(text)) return "travel";
  if (/christmas|thanksgiving|halloween|easter|holiday|valentine/.test(text)) return "holiday";
  if (/movie night|game night|dinner|family time|together|picnic/.test(text)) return "family_time";
  if (/funny|hilarious|laugh|silly|joke|oops/.test(text)) return "funny";
  if (/paint|draw|art|craft|creative|build|lego/.test(text)) return "creative";
  if (/love|miss|hug|kiss|thinking of you|tender|quiet/.test(text)) return "tender_moment";
  if (sourceType === "pulse") return "tender_moment";
  return "daily_life";
}

function inferEmotionalTone(sourceType: string, metadata: Record<string, unknown>): string {
  const text = [
    metadata.title as string || "",
    metadata.content as string || "",
    metadata.caption as string || "",
  ].join(" ").toLowerCase();

  if (/proud|achieved|accomplished|graduated|won|scored/.test(text)) return "proud";
  if (/hilarious|funny|laugh|silly|joke/.test(text)) return "playful";
  if (/miss|away|far|gone|lost|bittersweet/.test(text)) return "bittersweet";
  if (/grateful|thankful|blessed|appreciate/.test(text)) return "grateful";
  if (/quiet|peaceful|calm|serene|still/.test(text)) return "peaceful";
  if (/excited|amazing|incredible|wow|can't wait/.test(text)) return "excited";
  if (/love|tender|warm|gentle|sweet|hug|thinking/.test(text)) return "tender";
  if (sourceType === "pulse") return "tender";
  return "joyful";
}

// ─── Name Helpers ─────────────────────────────────────────────────────────

function firstName(name: string): string {
  if (name === "Dad" || name === "Mom") return name;
  return name.split(" ")[0];
}

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

// ─── Memory Engine ────────────────────────────────────────────────────────

export class MemoryEngine {
  async ingestPhoto(photo: Photo, familyMembers: FamilyMember[]): Promise<MemoryAtom> {
    const uploader = familyMembers.find(m => m.id === photo.uploadedById);
    const uploaderName = uploader ? firstName(uploader.name) : "Someone";
    const title = photo.caption
      ? `${uploaderName} captured: ${photo.caption}`
      : `A moment captured by ${uploaderName}`;

    const metadata: Record<string, unknown> = {
      photoUrl: photo.url,
      caption: photo.caption || "",
      uploadedBy: uploaderName,
    };

    return storage.createMemoryAtom({
      familyId: photo.familyId,
      sourceType: "photo",
      sourceId: photo.id,
      title,
      description: photo.caption || null,
      memberIds: JSON.stringify([photo.uploadedById]),
      createdById: photo.uploadedById,
      category: inferCategory("photo", metadata),
      emotionalTone: inferEmotionalTone("photo", metadata),
      occurredAt: photo.takenAt || photo.createdAt,
      metadata: JSON.stringify(metadata),
    });
  }

  async ingestMessage(message: Message, familyMembers: FamilyMember[]): Promise<MemoryAtom> {
    const author = familyMembers.find(m => m.id === message.authorId);
    const authorName = author ? firstName(author.name) : "Someone";
    const recipient = message.recipientId
      ? familyMembers.find(m => m.id === message.recipientId)
      : null;
    const recipientName = recipient ? firstName(recipient.name) : "the family";

    const title = message.type === "rose"
      ? `${authorName} shared a rose for ${recipientName}`
      : message.type === "thorn"
        ? `${authorName} reflected on the day`
        : `${authorName} wrote to ${recipientName}`;

    const memberIds = [message.authorId];
    if (message.recipientId) memberIds.push(message.recipientId);

    const metadata: Record<string, unknown> = {
      title: message.title,
      content: message.content,
      type: message.type,
      authorName,
      recipientName,
    };

    return storage.createMemoryAtom({
      familyId: message.familyId,
      sourceType: "message",
      sourceId: message.id,
      title,
      description: message.content.substring(0, 200),
      memberIds: JSON.stringify(memberIds),
      createdById: message.authorId,
      category: inferCategory("message", metadata),
      emotionalTone: inferEmotionalTone("message", metadata),
      occurredAt: message.createdAt,
      metadata: JSON.stringify(metadata),
    });
  }

  async ingestEvent(event: CalendarEvent, familyMembers: FamilyMember[]): Promise<MemoryAtom> {
    const eventMemberIds: number[] = event.memberIds ? JSON.parse(event.memberIds) : [];
    const memberNames = eventMemberIds
      .map(id => familyMembers.find(m => m.id === id))
      .filter(Boolean)
      .map(m => firstName(m!.name));

    const whoText = memberNames.length > 0
      ? memberNames.length <= 2 ? memberNames.join(" and ") : `${memberNames.slice(0, -1).join(", ")} and ${memberNames[memberNames.length - 1]}`
      : "the family";

    const title = `${event.title}${event.location ? ` at ${event.location}` : ""}`;

    const metadata: Record<string, unknown> = {
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      source: event.source,
      memberNames,
    };

    return storage.createMemoryAtom({
      familyId: event.familyId,
      sourceType: "event",
      sourceId: event.id,
      title,
      description: event.description || `${whoText} ${memberNames.length > 0 ? "attended" : "had"} ${event.title}`,
      memberIds: JSON.stringify(eventMemberIds.length > 0 ? eventMemberIds : []),
      createdById: null,
      category: inferCategory("event", metadata),
      emotionalTone: inferEmotionalTone("event", metadata),
      occurredAt: event.startDate,
      metadata: JSON.stringify(metadata),
    });
  }

  async ingestPulse(pulse: ThinkingOfYouPulse, familyMembers: FamilyMember[]): Promise<MemoryAtom> {
    const sender = familyMembers.find(m => m.id === pulse.senderId);
    const recipient = familyMembers.find(m => m.id === pulse.recipientId);
    const senderName = sender ? firstName(sender.name) : "Someone";
    const recipientName = recipient ? firstName(recipient.name) : "someone";

    return storage.createMemoryAtom({
      familyId: pulse.familyId,
      sourceType: "pulse",
      sourceId: pulse.id,
      title: `${senderName} was thinking of ${recipientName}`,
      description: `A quiet moment of love — ${senderName} let ${recipientName} know they were on their mind.`,
      memberIds: JSON.stringify([pulse.senderId, pulse.recipientId]),
      createdById: pulse.senderId,
      category: "tender_moment",
      emotionalTone: "tender",
      occurredAt: pulse.createdAt,
      metadata: JSON.stringify({
        senderName,
        senderEmoji: sender?.emoji || "💛",
        recipientName,
        recipientEmoji: recipient?.emoji || "💛",
      }),
    });
  }

  async ingestChat(chat: ChatMessage, familyMembers: FamilyMember[]): Promise<MemoryAtom> {
    const member = familyMembers.find(m => firstName(m.name) === chat.senderName || m.name === chat.senderName);

    const metadata: Record<string, unknown> = {
      content: chat.content,
      platform: chat.platform,
      senderName: chat.senderName,
    };

    return storage.createMemoryAtom({
      familyId: chat.familyId,
      sourceType: "chat",
      sourceId: chat.id,
      title: `${chat.senderName} via ${chat.platform}`,
      description: chat.content.substring(0, 200),
      memberIds: member ? JSON.stringify([member.id]) : null,
      createdById: member?.id || null,
      category: inferCategory("chat", metadata),
      emotionalTone: inferEmotionalTone("chat", metadata),
      occurredAt: chat.createdAt,
      metadata: JSON.stringify(metadata),
    });
  }

  // ─── On This Day ──────────────────────────────────────────────────────

  async getOnThisDay(familyId: number, date: string): Promise<MemoryAtom[]> {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const thisYear = d.getFullYear();
    const all = await storage.getMemoryAtoms(familyId, { limit: 10000 });
    return all.filter(a => {
      const ad = new Date(a.occurredAt);
      const am = String(ad.getMonth() + 1).padStart(2, "0");
      const aDay = String(ad.getDate()).padStart(2, "0");
      return am === month && aDay === day && ad.getFullYear() < thisYear;
    });
  }

  // ─── Personal Lens ──────────────────────────────────────────────────

  async getPersonalLens(familyId: number, memberId: number, otherMemberId: number): Promise<MemoryAtom[]> {
    return storage.getMemoryAtoms(familyId, {
      memberIds: [memberId, otherMemberId],
      limit: 100,
    });
  }

  // ─── Search ─────────────────────────────────────────────────────────

  async searchMemories(familyId: number, query: string): Promise<MemoryAtom[]> {
    return storage.searchMemoryAtoms(familyId, query);
  }

  // ─── Compilation Generation ─────────────────────────────────────────

  async generateWeeklyCompilation(familyId: number, weekStart: string, weekEnd: string): Promise<MemoryCompilation> {
    const atoms = await storage.getMemoryAtomsByDateRange(familyId, weekStart, weekEnd);
    const family = await storage.getFamilyById(familyId);
    const members = await storage.getFamilyMembers(familyId);

    if (!family) throw new Error("Family not found");

    const narrative = this.generateNarrative(atoms, family, members, "week");
    const coverAtom = atoms.find(a => a.sourceType === "photo") || atoms[0];

    const startDate = new Date(weekStart);
    const endDate = new Date(weekEnd);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return storage.createMemoryCompilation({
      familyId,
      type: "weekly",
      title: `Week of ${monthNames[startDate.getMonth()]} ${startDate.getDate()}–${endDate.getDate()}, ${endDate.getFullYear()}`,
      narrative,
      coverAtomId: coverAtom?.id || null,
      atomIds: JSON.stringify(atoms.map(a => a.id)),
      perspectiveMemberId: null,
      periodStart: weekStart,
      periodEnd: weekEnd,
      generatedAt: new Date().toISOString(),
    });
  }

  async generateMonthlyCompilation(familyId: number, month: string, year: number): Promise<MemoryCompilation> {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIdx = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
    if (monthIdx === -1) throw new Error("Invalid month name");

    const start = new Date(year, monthIdx, 1).toISOString();
    const end = new Date(year, monthIdx + 1, 0, 23, 59, 59).toISOString();

    const atoms = await storage.getMemoryAtomsByDateRange(familyId, start, end);
    const family = await storage.getFamilyById(familyId);
    const members = await storage.getFamilyMembers(familyId);

    if (!family) throw new Error("Family not found");

    const narrative = this.generateNarrative(atoms, family, members, "month");
    const coverAtom = atoms.find(a => a.sourceType === "photo") || atoms[0];

    return storage.createMemoryCompilation({
      familyId,
      type: "monthly",
      title: `${monthNames[monthIdx]} ${year}`,
      narrative,
      coverAtomId: coverAtom?.id || null,
      atomIds: JSON.stringify(atoms.map(a => a.id)),
      perspectiveMemberId: null,
      periodStart: start,
      periodEnd: end,
      generatedAt: new Date().toISOString(),
    });
  }

  // ─── Narrative Generation ───────────────────────────────────────────

  generateNarrative(atoms: MemoryAtom[], family: Family, members: FamilyMember[], period: string): string {
    const familyName = family.name.replace("The ", "").replace(" Family", "");

    if (atoms.length === 0) {
      return `A quiet ${period} for the ${familyName} family — sometimes the sweetest moments are the simplest ones. The best memories are still being made.`;
    }

    const photos = atoms.filter(a => a.sourceType === "photo");
    const msgs = atoms.filter(a => a.sourceType === "message");
    const events = atoms.filter(a => a.sourceType === "event");
    const pulses = atoms.filter(a => a.sourceType === "pulse");
    const chats = atoms.filter(a => a.sourceType === "chat");

    const parts: string[] = [];

    // Opening line
    const periodLabel = period === "week" ? "This week" : period === "month" ? "This month" : "During this time";
    parts.push(`${periodLabel} in the ${familyName} family`);

    // Pulse narrative — the emotional heartbeat
    if (pulses.length > 0) {
      const pulsePairs = new Map<string, { sender: string; recipient: string; count: number }>();
      for (const p of pulses) {
        const meta = JSON.parse(p.metadata || "{}");
        const key = `${meta.senderName}-${meta.recipientName}`;
        const existing = pulsePairs.get(key);
        if (existing) {
          existing.count++;
        } else {
          pulsePairs.set(key, { sender: meta.senderName, recipient: meta.recipientName, count: 1 });
        }
      }
      const topPulse = [...pulsePairs.values()].sort((a, b) => b.count - a.count)[0];
      if (topPulse) {
        const times = topPulse.count === 1 ? "once" : topPulse.count === 2 ? "twice" : `${topPulse.count} times`;
        parts.push(`${topPulse.sender} was thinking of ${topPulse.recipient} ${times} — those quiet moments that say everything without words`);
      }
    }

    // Events narrative
    if (events.length > 0) {
      const eventDescriptions: string[] = [];
      for (const e of events.slice(0, 3)) {
        const meta = JSON.parse(e.metadata || "{}");
        const names = (meta.memberNames as string[]) || [];
        if (names.length > 0) {
          eventDescriptions.push(`${names.join(" and ")} had ${meta.title || e.title}`);
        } else {
          eventDescriptions.push(meta.title || e.title);
        }
      }
      if (eventDescriptions.length === 1) {
        parts.push(eventDescriptions[0]);
      } else {
        parts.push(eventDescriptions.join(", and "));
      }
    }

    // Messages narrative
    if (msgs.length > 0) {
      const messageAuthors = new Set<string>();
      for (const m of msgs) {
        const meta = JSON.parse(m.metadata || "{}");
        if (meta.authorName) messageAuthors.add(meta.authorName as string);
      }
      const roseMessages = msgs.filter(m => {
        const meta = JSON.parse(m.metadata || "{}");
        return meta.type === "rose" || meta.type === "thorn";
      });
      if (roseMessages.length > 0) {
        const firstRose = roseMessages[0];
        const meta = JSON.parse(firstRose.metadata || "{}");
        const snippet = (meta.content as string || "").substring(0, 80);
        parts.push(`${meta.authorName || "Someone"} shared a heartfelt note: "${snippet}..."`);
      } else if (msgs.length > 0) {
        parts.push(`${msgs.length} ${msgs.length === 1 ? "message was" : "messages were"} shared between family members`);
      }
    }

    // Photos narrative
    if (photos.length > 0) {
      const photoUploaders = new Set<string>();
      for (const p of photos) {
        const meta = JSON.parse(p.metadata || "{}");
        if (meta.uploadedBy) photoUploaders.add(meta.uploadedBy as string);
      }
      const names = [...photoUploaders];
      if (names.length > 0 && photos.length > 0) {
        const captioned = photos.filter(p => {
          const meta = JSON.parse(p.metadata || "{}");
          return meta.caption;
        });
        if (captioned.length > 0) {
          const firstCaption = JSON.parse(captioned[0].metadata || "{}").caption as string;
          parts.push(`${names[0]} captured a moment${firstCaption ? ` — "${firstCaption}"` : ""}`);
        } else {
          parts.push(`${photos.length} ${photos.length === 1 ? "photo was" : "photos were"} added to the family album`);
        }
      }
    }

    // Closing line
    const closings = [
      `It was a ${period} of small moments that add up to everything.`,
      `These are the moments that make a family.`,
      `Another chapter in the ${familyName} story, beautifully lived.`,
      `The kind of ${period} you'll want to remember.`,
      `Love, expressed in a hundred small ways.`,
    ];
    const closingIndex = atoms.length % closings.length;

    // Assemble narrative
    let narrative = parts[0]; // Opening
    if (parts.length > 1) {
      narrative += ", " + parts.slice(1).join(". ") + ".";
    } else {
      narrative += " — a time of quiet togetherness.";
    }
    narrative += " " + closings[closingIndex];

    return narrative;
  }

  // ─── Ingest All Existing Content ──────────────────────────────────────

  async ingestAllExisting(familyId: number): Promise<number> {
    const members = await storage.getFamilyMembers(familyId);
    let count = 0;

    const allPhotos = await storage.getPhotos(familyId);
    for (const photo of allPhotos) {
      const existing = await storage.getMemoryAtomsBySourceType(familyId, "photo", photo.id);
      if (existing.length === 0) {
        await this.ingestPhoto(photo, members);
        count++;
      }
    }

    const allMessages = await storage.getMessages(familyId);
    for (const msg of allMessages) {
      const existing = await storage.getMemoryAtomsBySourceType(familyId, "message", msg.id);
      if (existing.length === 0) {
        await this.ingestMessage(msg, members);
        count++;
      }
    }

    const allEvents = await storage.getCalendarEvents(familyId);
    for (const event of allEvents) {
      const existing = await storage.getMemoryAtomsBySourceType(familyId, "event", event.id);
      if (existing.length === 0) {
        await this.ingestEvent(event, members);
        count++;
      }
    }

    const allPulses = await storage.getThinkingOfYouPulses(familyId);
    for (const pulse of allPulses) {
      const existing = await storage.getMemoryAtomsBySourceType(familyId, "pulse", pulse.id);
      if (existing.length === 0) {
        await this.ingestPulse(pulse, members);
        count++;
      }
    }

    const allChats = await storage.getChatMessages(familyId);
    for (const chat of allChats) {
      const existing = await storage.getMemoryAtomsBySourceType(familyId, "chat", chat.id);
      if (existing.length === 0) {
        await this.ingestChat(chat, members);
        count++;
      }
    }

    return count;
  }
}

export const memoryEngine = new MemoryEngine();
