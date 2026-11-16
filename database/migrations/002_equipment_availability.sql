BEGIN;

ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_status_check;

UPDATE equipment
SET status = 'unavailable'
WHERE status = 'maintenance';

ALTER TABLE equipment
    ADD CONSTRAINT equipment_status_check
    CHECK (status IN ('available', 'unavailable'));

COMMIT;
