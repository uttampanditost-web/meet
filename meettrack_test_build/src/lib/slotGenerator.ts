import { Slot, Trainer } from "../types";

/**
 * Generates daily slots for a trainer from 8:00 AM to 11:00 PM.
 * For 30-minute intervals, this produces exactly 31 slots:
 * 08:00-08:30 all the way to 23:00-23:30 (starts at 11:00 PM).
 */
export function generateDaySlotsForTrainer(
  trainer: Trainer,
  dateStr: string,
  userEmail?: string
): Slot[] {
  const duration = (trainer.slotDuration === 45 || trainer.slotDuration === 60) ? trainer.slotDuration : 30;
  const startMinutes = 8 * 60;    // 08:00 (8:00 AM)
  const lastSlotStart = 23 * 60;  // 23:00 (11:00 PM) -> 31 slots for 30m
  const generatedSlots: Slot[] = [];

  for (let m = startMinutes; m <= lastSlotStart; m += duration) {
    const startHour = Math.floor(m / 60);
    const startMin = m % 60;
    const endM = m + duration;
    const endHour = Math.floor(endM / 60);
    const endMin = endM % 60;

    const startTime = `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}`;
    const endTime = `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;

    const slotId = `slot-${trainer.id}-${dateStr}-${startTime.replace(":", "")}`;

    generatedSlots.push({
      id: slotId,
      trainerId: trainer.id,
      trainerName: trainer.name,
      date: dateStr,
      startTime,
      endTime,
      studentName: "Open Slot",
      studentEmail: "",
      topic: `${trainer.specialization || "1:1 Mentorship"} (${duration}m Session)`,
      status: "scheduled",
      meetUrl: trainer.meetUrl,
      userEmail: userEmail || trainer.userEmail || "",
    });
  }
  return generatedSlots;
}

/**
 * Ensures every active mentor has their full 8:00 AM - 11:00 PM (31 slots) schedule
 * for the selected date. Returns both the merged slots and only the newly generated ones.
 */
export function ensureSlotsForTrainers(
  trainers: Trainer[],
  existingSlots: Slot[],
  dateStr: string,
  userEmail?: string
): { updatedSlots: Slot[]; newSlotsGenerated: Slot[] } {
  if (!trainers.length || !dateStr || dateStr === "all") {
    return { updatedSlots: existingSlots, newSlotsGenerated: [] };
  }

  const slotsMap = new Map<string, Slot>();
  existingSlots.forEach((s) => {
    if (s && s.id) {
      slotsMap.set(s.id, s);
    }
  });

  const newSlotsGenerated: Slot[] = [];

  trainers.forEach((trainer) => {
    if (trainer.status === "inactive" || !trainer.id || !trainer.name) return;

    // Check existing slots for this trainer on this date
    const trainerDateSlots = existingSlots.filter(
      (s) => s.trainerId === trainer.id && s.date === dateStr
    );

    // If mentor has 0 slots on this date, auto-generate all 31 slots
    if (trainerDateSlots.length === 0) {
      const daySlots = generateDaySlotsForTrainer(trainer, dateStr, userEmail || trainer.userEmail);
      daySlots.forEach((slot) => {
        if (!slotsMap.has(slot.id)) {
          slotsMap.set(slot.id, slot);
          newSlotsGenerated.push(slot);
        }
      });
    }
  });

  return {
    updatedSlots: Array.from(slotsMap.values()),
    newSlotsGenerated,
  };
}
