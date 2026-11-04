CREATE TABLE follows (
    follower_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followed_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_user_id),
    CHECK (follower_id <> followed_user_id)
);
CREATE INDEX follows_followed_user_id_idx ON follows (followed_user_id);
