-- Riwayat chat publik mall: pesan guest tetap ada setelah refresh.
-- Ditulis/dibaca langsung via supabase-js (anon key) mengikuti pola transport
-- chat yang sudah ada (Realtime broadcast); API Go tidak dilibatkan karena
-- semua tulis di API wajib requireAuth sementara chat mall mengizinkan guest.
CREATE TABLE mall_messages (
    id         text PRIMARY KEY,
    name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
    text       text NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mall_messages_created_at_idx ON mall_messages (created_at DESC);

-- Chat publik: baca terbuka, tulis terbuka dalam batas CHECK di atas.
-- Kedua role dicakup karena tab yang login mengirim JWT user (authenticated),
-- tab guest mengirim anon key saja (anon); kedua client berbagi storage key.
ALTER TABLE mall_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON mall_messages TO anon, authenticated;
CREATE POLICY mall_messages_public_read ON mall_messages
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY mall_messages_guest_insert ON mall_messages
    FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Simpan max 200 pesan terakhir; trigger SECURITY DEFINER agar prune
-- berjalan dengan hak owner dan tidak terhalang RLS saat insert via anon.
CREATE OR REPLACE FUNCTION prune_mall_messages() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM mall_messages
    WHERE id NOT IN (
        SELECT id FROM mall_messages ORDER BY created_at DESC, id DESC LIMIT 200
    );
    RETURN NEW;
END;
$$;
CREATE TRIGGER mall_messages_prune AFTER INSERT ON mall_messages
    FOR EACH ROW EXECUTE FUNCTION prune_mall_messages();
