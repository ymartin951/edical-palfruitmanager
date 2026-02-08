/*
  # Add Photo, Location, Driver, and Signed By Fields

  ## Overview
  This migration adds new fields to support agent photos, simplified location,
  driver names for fruit collections, and signed by for cash advances.

  ## Changes

  ### 1. Agents Table
  - Add `photo_url` (text) - URL/path to agent's photo in storage
  - Add `location` (text) - Simplified location field (replaces region/community in UI)
  - Keep `region` and `community` columns for backward compatibility

  ### 2. Fruit Collections Table
  - Add `driver_name` (text) - Name of the driver who took the load
  - Keep `notes` column for backward compatibility
  - Migrate existing notes to driver_name where driver_name is null

  ### 3. Cash Advances Table
  - Add `signed_by` (text) - Name of the person who gave the advance
  - Keep `notes` column for backward compatibility
  - Migrate existing notes to signed_by where signed_by is null

  ## Notes
  - All new fields are optional (nullable)
  - No data is dropped to ensure backward compatibility
  - Best-effort migration of notes to new fields
*/

-- Add new columns to agents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE agents ADD COLUMN photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'location'
  ) THEN
    ALTER TABLE agents ADD COLUMN location text;
  END IF;
END $$;

-- Add driver_name column to fruit_collections table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fruit_collections' AND column_name = 'driver_name'
  ) THEN
    ALTER TABLE fruit_collections ADD COLUMN driver_name text;
  END IF;
END $$;

-- Migrate existing notes to driver_name (best effort)
UPDATE fruit_collections
SET driver_name = notes
WHERE driver_name IS NULL AND notes IS NOT NULL AND notes != '';

-- Add signed_by column to cash_advances table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_advances' AND column_name = 'signed_by'
  ) THEN
    ALTER TABLE cash_advances ADD COLUMN signed_by text;
  END IF;
END $$;

-- Migrate existing notes to signed_by (best effort)
UPDATE cash_advances
SET signed_by = notes
WHERE signed_by IS NULL AND notes IS NOT NULL AND notes != '';