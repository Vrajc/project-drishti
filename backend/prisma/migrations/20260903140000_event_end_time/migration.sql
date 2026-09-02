-- When an event ends.
--
-- Nothing recorded it. Every screen that needed to know whether an event was
-- running added eight hours to its start time and called that the end, so an
-- event was reported live for eight hours whatever its actual length - and the
-- post-event report either printed "8 hours" for every event or, once that was
-- removed, had no duration to print at all.
--
-- Nullable because events created before this have no end to backfill, and
-- inventing one would be the same mistake in a migration instead of a page.
-- The setup form requires it for new events; screens say "not recorded" for the
-- rest rather than guessing.
ALTER TABLE "events" ADD COLUMN "endDate" TEXT;
ALTER TABLE "events" ADD COLUMN "endTime" TEXT;
