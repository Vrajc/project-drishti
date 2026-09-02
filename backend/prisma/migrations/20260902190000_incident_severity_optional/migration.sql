-- Incident severity becomes optional.
--
-- The column arrived as `NOT NULL DEFAULT 'MEDIUM'`. That stamped an
-- assessment onto every incident that already existed when it was added, and
-- onto every incident filed since: the reporting UI has never asked a filer for
-- a severity, so the default is what almost every manual row carries. The
-- dispatch console orders by it and the post-event report prints it, both
-- reading it as a judgement somebody made.
--
-- Null now means what it says: nobody has classified this incident.
ALTER TABLE "incidents" ALTER COLUMN "severity" DROP NOT NULL;
ALTER TABLE "incidents" ALTER COLUMN "severity" DROP DEFAULT;

-- Clear the values that can only have come from that default.
--
-- A MANUAL row holding MEDIUM was either defaulted or passed `severity=medium`
-- by an API caller; nothing in the product sends it, so in practice these are
-- all defaults. ANOMALY rows are left alone - the rule engine sets those
-- deliberately, MEDIUM included, and that is a real classification.
--
-- The trade-off is deliberate. Clearing a severity somebody did set loses
-- information; keeping one nobody set asserts something false, in a console
-- that decides where officers go and in a report that goes to an authority.
UPDATE "incidents"
SET "severity" = NULL
WHERE "source" = 'MANUAL' AND "severity" = 'MEDIUM';
