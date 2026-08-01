-- FF-035-B: make objective_id nullable on enterprise_sweeps
-- Portfolio sweeps (fork='portfolio') have no associated objective
ALTER TABLE enterprise_sweeps ALTER COLUMN objective_id DROP NOT NULL;
