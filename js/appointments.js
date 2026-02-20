export const SLOT_DURATION = 30; // minutes
export const MORNING_START = "08:00";
export const MORNING_END = "13:00";
export const AFTERNOON_START = "14:00";
export const AFTERNOON_END = "16:00";

export function generateTimeSlots() {
    const slots = [];

    // Morning Slots
    let current = timeToMinutes(MORNING_START);
    const endMorning = timeToMinutes(MORNING_END);
    while (current + SLOT_DURATION <= endMorning) {
        slots.push(minutesToTime(current));
        current += SLOT_DURATION;
    }

    // Afternoon Slots
    current = timeToMinutes(AFTERNOON_START);
    const endAfternoon = timeToMinutes(AFTERNOON_END);
    while (current + SLOT_DURATION <= endAfternoon) {
        slots.push(minutesToTime(current));
        current += SLOT_DURATION;
    }

    return slots;
}

function timeToMinutes(time) {
    const [hrs, mins] = time.split(':').map(Number);
    return hrs * 60 + mins;
}

function minutesToTime(mins) {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
