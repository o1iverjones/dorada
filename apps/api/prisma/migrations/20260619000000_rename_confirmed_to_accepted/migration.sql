-- Rename appointment status "confirmed" → "accepted"
UPDATE "appointments" SET status = 'accepted' WHERE status = 'confirmed';

-- Rename appointment offer status "confirmed" → "accepted"
UPDATE "appointment_offers" SET status = 'accepted' WHERE status = 'confirmed';
