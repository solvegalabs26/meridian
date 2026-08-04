-- FF-025: Allow users to update their own objective_outcomes rows.
-- Needed so the /api/outcomes/[id] PATCH route can back-fill prediction_id
-- after a prediction is scored from the outcome capture modal.

DROP POLICY IF EXISTS "Users update own outcomes" ON public.objective_outcomes;
CREATE POLICY "Users update own outcomes"
  ON public.objective_outcomes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
