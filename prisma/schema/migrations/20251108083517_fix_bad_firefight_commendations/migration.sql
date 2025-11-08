BEGIN;

-- Step 1: Rename the old enum values
ALTER TYPE reach.commendation RENAME VALUE 'matchmaking_domeinspector' TO 'firefight_domeinspector';
ALTER TYPE reach.commendation RENAME VALUE 'matchmaking_numbersgame' TO 'firefight_numbersgame';

COMMIT;