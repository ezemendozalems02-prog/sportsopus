-- Cobro de señas por transferencia manual (mientras no está conectado el
-- Mercado Pago Connect por club) -- cada organización configura su propio
-- alias/CBU y su WhatsApp para que el cliente mande el comprobante.
alter table organizations
  add column payment_alias text,
  add column whatsapp_number text;
