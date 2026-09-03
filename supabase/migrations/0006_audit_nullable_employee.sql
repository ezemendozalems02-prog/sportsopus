-- audit_logs.employee_id era NOT NULL, pero algunas acciones auditadas las
-- inicia el cliente final sin empleado de por medio (canje de puntos,
-- inscripción a un torneo) — el mock ya las registraba con employeeId=null
-- ("Sistema"). Se relaja la constraint para que el registro real coincida.
alter table audit_logs alter column employee_id drop not null;
