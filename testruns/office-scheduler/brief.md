# Shiftline — Office Shift & Appointment Scheduler

## What this is
An internal tool for scheduling office shifts and appointments. A manager builds
a weekly rota for staff and books rooms for appointments; staff see their own
upcoming shifts and any conflicts are surfaced before they happen.

## Users
- **Manager** — builds the rota, assigns shifts, books appointments.
- **Staff** — view their own shifts and request time off.
- **Reception** — books appointments into rooms.

## Core domain
- **Staff**: id, name, role, weekly hour cap, active.
- **Room**: id, name, capacity, active.
- **Shift**: id, staff, date, start time, end time, role note.
- **Appointment**: id, title, room, date, start time, end time, booked-by,
  attendee count (must not exceed room capacity).
- **TimeOffRequest**: id, staff, start date, end date, status (Requested |
  Approved | Denied), note.

## Required features
1. **Weekly rota** — a 7-day grid (Monday–Sunday) with shifts per day per staff.
   Add a shift by picking staff, date, start, end. Refuse overlapping shifts for
   the same staff member on the same day.
2. **Hour cap check** — when a shift would push a staff member over their weekly
   hour cap, warn and refuse (or allow with an explicit override flag); show the
   running weekly hours per staff.
3. **Appointments** — book an appointment into a room; refuse double-booking the
   same room at overlapping times and refuse attendee count over room capacity.
4. **Conflict detector** — a screen that scans the week and lists every hard
   conflict (double-booked room, overlapping staff shift, shift overlapping
   approved time off) with the two offending entries named.
5. **Staff view** — pick a staff member and see their shifts for the current week
   plus approved/denied time off.
6. **Time off** — request time off; manager approves or denies with a note. An
   approved time-off range that overlaps an existing shift is flagged in the
   conflict detector.

## Functional requirements
- Times are stored as minutes-from-midnight integers per date; durations and
  overlaps are computed from integers (exact, no timezone ambiguity).
- Overlap rule: two intervals overlap iff startA < endB && startB < endA.
- Weekly hours sum shift durations against the staff cap.
- All conflict checks are pure functions over the schedule data, unit-testable,
  and reused by both the rota builder and the conflict screen.
- Refusals name the specific conflicting entry.

## Non-functional requirements
- Desktop-first, usable to 1024px; keyboard-navigable grid.
- Accessible: labelled time inputs, table/grid roles where appropriate.
- Deterministic scheduling logic separated from UI.
- Local persistence; no external calendar integration required.

## Explicitly out of scope
- Google/Outlook calendar sync.
- Recurring shifts or RRULE expansion.
- Payroll calculations from hours.
- Notifications by email/SMS.
