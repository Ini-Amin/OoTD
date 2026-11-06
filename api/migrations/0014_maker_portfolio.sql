-- Maker portfolio: a maker links a published outfit as the finished result
-- of a done craft request. First maker to link wins (UNIQUE(request_id));
-- see the broadcast-inbox note in 0012_maker_unread.sql.
CREATE TABLE maker_portfolio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    maker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id uuid NOT NULL REFERENCES craft_requests(id) ON DELETE CASCADE,
    outfit_id uuid NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(request_id),
    UNIQUE(maker_id, outfit_id)
);
CREATE INDEX maker_portfolio_maker_idx ON maker_portfolio (maker_id, created_at DESC);
