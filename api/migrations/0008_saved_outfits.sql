CREATE TABLE saved_outfits (
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    outfit_id  uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, outfit_id)
);
CREATE INDEX saved_outfits_outfit_id_idx ON saved_outfits (outfit_id);
