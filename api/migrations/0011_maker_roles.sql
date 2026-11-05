-- Peran akun marketplace: 'user' bawaan, 'maker' untuk craftsmaker.
-- Kolom di users (bukan user_metadata Supabase) agar konsisten dengan repo:
-- profil dibaca/ditulis Go via /v1/me dan JWT hanya membawa sub/email.
-- Penetapan maker dilakukan admin via UPDATE langsung (tidak ada self-upgrade).
ALTER TABLE users
    ADD COLUMN role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'maker'));
CREATE INDEX users_role_idx ON users (role) WHERE role = 'maker';
