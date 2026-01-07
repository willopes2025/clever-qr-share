-- Add UPDATE policy for instagram_scrape_results
CREATE POLICY "Users can update their own scrape results" 
ON public.instagram_scrape_results 
FOR UPDATE 
TO public 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);