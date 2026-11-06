-- Accepted risk (same as save_count): comment_count is maintained by the
-- app's delete path only. If user deletion ever ships, backfill with a
-- recount or add an AFTER DELETE trigger, since the author_id CASCADE
-- below does not decrement this column.
ALTER TABLE outfits ADD COLUMN comment_count int NOT NULL DEFAULT 0 CHECK (comment_count >= 0);

CREATE TABLE outfit_comments (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    outfit_id  uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
    author_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body       text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outfit_comments_outfit_created_idx ON outfit_comments (outfit_id, created_at, id);
