-- Signal Coherence Layer — sweeps tracking column
-- Marks which sweep runs had a non-null coherence package injected
-- (i.e., at least one objective had active watch sources at sweep time).
ALTER TABLE sweeps ADD COLUMN IF NOT EXISTS coherence_package_used boolean DEFAULT false;
