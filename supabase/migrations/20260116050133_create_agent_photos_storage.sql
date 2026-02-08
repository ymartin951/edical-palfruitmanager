/*
  # Create Agent Photos Storage Bucket

  ## Overview
  This migration creates a storage bucket for agent photos with appropriate
  security policies.

  ## Changes
  1. Create `agent-photos` storage bucket
  2. Set bucket to public for easy access
  3. Add storage policies:
     - Admins can upload photos
     - Anyone (authenticated) can view photos
     - Admins can update/delete photos

  ## Security
  - Only authenticated admin users can upload, update, or delete photos
  - Photos are publicly readable for display purposes
*/

-- Create the storage bucket for agent photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-photos', 'agent-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Admins can upload agent photos
CREATE POLICY "Admins can upload agent photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agent-photos' AND
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Policy: Anyone authenticated can view agent photos
CREATE POLICY "Authenticated users can view agent photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'agent-photos');

-- Policy: Admins can update agent photos
CREATE POLICY "Admins can update agent photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agent-photos' AND
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  )
  WITH CHECK (
    bucket_id = 'agent-photos' AND
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Policy: Admins can delete agent photos
CREATE POLICY "Admins can delete agent photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agent-photos' AND
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );