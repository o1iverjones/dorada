-- Normalize interpreter.type to lowercase to match application enum values
UPDATE "interpreters" SET "type" = LOWER("type") WHERE "type" != LOWER("type");

-- Normalize appointment.interpreter_type_required to lowercase
UPDATE "appointments" SET "interpreter_type_required" = LOWER("interpreter_type_required") WHERE "interpreter_type_required" != LOWER("interpreter_type_required");
