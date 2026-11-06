-- Queue for generic social-mention webhooks (POST /v1/ingest/mentions).
-- Plain portable Postgres: no Supabase-specific DDL.
CREATE TABLE social_mentions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    platform      text NOT NULL CHECK (length(platform) BETWEEN 1 AND 32),
    external_id   text NOT NULL UNIQUE CHECK (length(external_id) BETWEEN 1 AND 128),
    author_handle text NOT NULL DEFAULT '' CHECK (length(author_handle) <= 80),
    image_url     text NOT NULL,
    caption       text NOT NULL DEFAULT '' CHECK (length(caption) <= 2000),
    occurred_at   timestamptz NULL,
    status        text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'done', 'failed')),
    attempts      int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    outfit_id     uuid REFERENCES outfits (id) ON DELETE SET NULL,
    result        jsonb NULL,
    error         text NOT NULL DEFAULT '',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX social_mentions_queued_idx
    ON social_mentions (status, created_at) WHERE status = 'queued';

-- System author for worker-created draft outfits (private/draft, never in feeds).
INSERT INTO users (username, display_name, bio)
VALUES ('ootd_bot', 'OoTD Auto-tag', 'System author for social-mention auto-tag drafts.')
ON CONFLICT (username) DO NOTHING;
