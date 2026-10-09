-- Themes are allowlisted tokens only: no custom CSS/JS (see TECHNICAL_REQUIREMENTS.md §9).
CREATE TABLE themes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
    name       text NOT NULL,
    bg         text NOT NULL CHECK (bg ~ '^#[0-9a-f]{6}$'),
    surface    text NOT NULL CHECK (surface ~ '^#[0-9a-f]{6}$'),
    fg         text NOT NULL CHECK (fg ~ '^#[0-9a-f]{6}$'),
    accent     text NOT NULL CHECK (accent ~ '^#[0-9a-f]{6}$'),
    font       text NOT NULL CHECK (font IN ('sans', 'serif', 'rounded', 'mono')),
    radius     text NOT NULL CHECK (radius IN ('sharp', 'soft', 'round')),
    sort_order int  NOT NULL DEFAULT 0
);

CREATE TABLE users (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username     text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,30}$'),
    display_name text NOT NULL,
    bio          text NOT NULL DEFAULT '',
    theme_id     uuid REFERENCES themes (id),
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outfits (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id    uuid NOT NULL REFERENCES users (id),
    title        text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    caption      text NOT NULL DEFAULT '' CHECK (length(caption) <= 2000),
    accent       text NOT NULL CHECK (accent ~ '^#[0-9a-f]{6}$'),
    visibility   text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    status       text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'removed')),
    save_count   int  NOT NULL DEFAULT 0 CHECK (save_count >= 0),
    published_at timestamptz NOT NULL DEFAULT now(),
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outfits_feed_idx ON outfits (published_at DESC) WHERE visibility = 'public' AND status = 'published';

CREATE TABLE tags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    normalized_name text NOT NULL UNIQUE,
    display_name    text NOT NULL
);

CREATE TABLE outfit_tags (
    outfit_id uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
    tag_id    uuid NOT NULL REFERENCES tags (id),
    PRIMARY KEY (outfit_id, tag_id)
);
