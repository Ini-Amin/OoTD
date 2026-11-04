CREATE TABLE collections (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
    description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
    visibility  text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collections_owner_id_idx ON collections (owner_id);

CREATE TABLE collection_items (
    collection_id uuid NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
    outfit_id     uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
    sort_order    int  NOT NULL DEFAULT 0,
    PRIMARY KEY (collection_id, outfit_id)
);
CREATE INDEX collection_items_outfit_id_idx ON collection_items (outfit_id);
