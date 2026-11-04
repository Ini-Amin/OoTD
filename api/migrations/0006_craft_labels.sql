-- Craft requests can reference closet pieces that have no DB row (mall
-- try-ons, preview outfits), so keep a human-readable label next to the
-- nullable uuid references.
ALTER TABLE craft_requests
    ADD COLUMN outfit_label text CHECK (outfit_label IS NULL OR (length(outfit_label) BETWEEN 1 AND 120)),
    ADD COLUMN piece_label text CHECK (piece_label IS NULL OR (length(piece_label) BETWEEN 1 AND 120));
