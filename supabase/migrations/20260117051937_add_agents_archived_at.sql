/*
  # Add archived_at column to agents table
  
  1. Changes
    - Add `archived_at` (timestamptz, nullable) to agents table
    - Allows soft-delete/archiving of agents instead of hard delete
    - Archived agents will have status INACTIVE and archived_at set
  
  2. Security
    - No RLS changes needed, uses existing policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE agents ADD COLUMN archived_at timestamptz;
  END IF;
END $$;
