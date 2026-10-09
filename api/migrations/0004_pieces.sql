CREATE TABLE outfit_pieces (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    outfit_id  uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
    category   text NOT NULL CHECK (category IN ('hat', 'top', 'bottom', 'shoes', 'bag', 'accessory')),
    label      text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
    x          real NOT NULL CHECK (x >= 0 AND x <= 1),
    y          real NOT NULL CHECK (y >= 0 AND y <= 1),
    w          real NOT NULL CHECK (w >= 0 AND w <= 1),
    h          real NOT NULL CHECK (h >= 0 AND h <= 1),
    sort_order int  NOT NULL DEFAULT 0,
    CONSTRAINT outfit_pieces_box_bounds CHECK (x + w <= 1 AND y + h <= 1)
);

CREATE INDEX outfit_pieces_outfit_id_idx ON outfit_pieces (outfit_id);

CREATE TABLE craft_requests (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id),
    category    text NOT NULL CHECK (category IN ('hat', 'top', 'bottom', 'shoes', 'bag', 'accessory')),
    description text NOT NULL CHECK (length(description) BETWEEN 10 AND 1000),
    budget_idr  bigint CHECK (budget_idr IS NULL OR (budget_idr >= 0 AND budget_idr <= 1000000000)),
    outfit_id   uuid REFERENCES outfits (id) ON DELETE SET NULL,
    piece_id    uuid REFERENCES outfit_pieces (id) ON DELETE SET NULL,
    status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'declined', 'done')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO outfit_pieces (outfit_id, category, label, x, y, w, h, sort_order)
SELECT o.id, p.category, p.label, p.x, p.y, p.w, p.h, p.sort_order
FROM (VALUES
    -- 1. Soft layers for a rainy campus day
    ('Soft layers for a rainy campus day', 'top',       'Oversized poplin shirt',     0.18, 0.16, 0.64, 0.34, 1),
    ('Soft layers for a rainy campus day', 'bottom',    'Wide-leg relaxed trousers',  0.22, 0.50, 0.56, 0.32, 2),
    ('Soft layers for a rainy campus day', 'shoes',     'Water-resistant loafers',    0.22, 0.83, 0.56, 0.15, 3),
    ('Soft layers for a rainy campus day', 'bag',       'Canvas messenger bag',       0.04, 0.35, 0.26, 0.30, 4),
    ('Soft layers for a rainy campus day', 'accessory', 'Amber umbrella detail',      0.30, 0.18, 0.40, 0.10, 5),

    -- 2. One jacket, three moods
    ('One jacket, three moods', 'top',       'Relaxed vintage jacket',        0.16, 0.16, 0.68, 0.34, 1),
    ('One jacket, three moods', 'bottom',    'Straight-leg washed denim',     0.22, 0.50, 0.56, 0.32, 2),
    ('One jacket, three moods', 'shoes',     'Classic beat-up sneakers',      0.22, 0.83, 0.56, 0.15, 3),
    ('One jacket, three moods', 'accessory', 'Brass buckle leather belt',     0.28, 0.48, 0.44, 0.06, 4),

    -- 3. Everyday earth tones
    ('Everyday earth tones', 'hat',    'Neutral bucket hat',          0.30, 0.02, 0.40, 0.13, 1),
    ('Everyday earth tones', 'top',    'Boxy linen overshirt',        0.18, 0.16, 0.64, 0.34, 2),
    ('Everyday earth tones', 'bottom', 'Olive drawstring trousers',   0.22, 0.50, 0.56, 0.32, 3),
    ('Everyday earth tones', 'shoes',  'Earth-tone canvas slip-ons',  0.22, 0.83, 0.56, 0.15, 4),
    ('Everyday earth tones', 'bag',    'Woven cotton shoulder tote',  0.70, 0.35, 0.25, 0.30, 5),

    -- 4. Charcoal tailoring for mid-week studio reviews
    ('Charcoal tailoring for mid-week studio reviews', 'top',       'Oversized charcoal wool blazer', 0.15, 0.16, 0.70, 0.34, 1),
    ('Charcoal tailoring for mid-week studio reviews', 'accessory', 'Cream mock-neck tee',            0.30, 0.18, 0.40, 0.14, 2),
    ('Charcoal tailoring for mid-week studio reviews', 'bottom',    'Relaxed pleated trousers',       0.20, 0.50, 0.60, 0.32, 3),
    ('Charcoal tailoring for mid-week studio reviews', 'shoes',     'Minimal leather derbies',        0.22, 0.83, 0.56, 0.15, 4),
    ('Charcoal tailoring for mid-week studio reviews', 'bag',       'Leather portfolio case',         0.04, 0.38, 0.24, 0.28, 5),

    -- 5. High-summer crisp poplin and ecru
    ('High-summer crisp poplin and ecru', 'hat',    'Woven straw sun hat',                 0.28, 0.02, 0.44, 0.13, 1),
    ('High-summer crisp poplin and ecru', 'top',    'Lightweight white poplin button-down',0.18, 0.16, 0.64, 0.34, 2),
    ('High-summer crisp poplin and ecru', 'bottom', 'Ecru straight trousers',              0.22, 0.50, 0.56, 0.32, 3),
    ('High-summer crisp poplin and ecru', 'shoes',  'Woven leather slides',                0.22, 0.83, 0.56, 0.15, 4),

    -- 6. Cold morning library run
    ('Cold morning library run', 'hat',    'Heavy ribbed knit beanie',     0.32, 0.02, 0.36, 0.12, 1),
    ('Cold morning library run', 'top',    'Quilted black liner jacket',   0.15, 0.15, 0.70, 0.35, 2),
    ('Cold morning library run', 'bottom', 'Cropped wide-leg chinos',      0.22, 0.50, 0.56, 0.32, 3),
    ('Cold morning library run', 'shoes',  'Suede trail shoes',            0.22, 0.83, 0.56, 0.15, 4),
    ('Cold morning library run', 'bag',    'Heavy canvas library tote',    0.70, 0.36, 0.25, 0.32, 5),

    -- 7. Faded denim chore coat and 90s wash
    ('Faded denim chore coat and 90s wash', 'top',       'Faded vintage chore jacket', 0.16, 0.16, 0.68, 0.34, 1),
    ('Faded denim chore coat and 90s wash', 'accessory', 'Vintage white tee layer',    0.28, 0.20, 0.44, 0.16, 2),
    ('Faded denim chore coat and 90s wash', 'bottom',    'Washed black 90s denim',     0.22, 0.50, 0.56, 0.32, 3),
    ('Faded denim chore coat and 90s wash', 'shoes',     'Beaten suede Wallabees',     0.22, 0.83, 0.56, 0.15, 4),

    -- 8. Oversized track jacket and baggy cargos
    ('Oversized track jacket and baggy cargos', 'hat',       'Black technical nylon cap',     0.30, 0.02, 0.40, 0.13, 1),
    ('Oversized track jacket and baggy cargos', 'top',       'Two-tone nylon windbreaker',    0.15, 0.16, 0.70, 0.34, 2),
    ('Oversized track jacket and baggy cargos', 'bottom',    'Baggy technical cargo pants',   0.20, 0.50, 0.60, 0.32, 3),
    ('Oversized track jacket and baggy cargos', 'shoes',     'Chunky platform sneakers',      0.22, 0.83, 0.56, 0.15, 4),
    ('Oversized track jacket and baggy cargos', 'accessory', 'Chunky silver chain hardware',  0.32, 0.48, 0.36, 0.08, 5),

    -- 9. Caramel corduroy and heavy rib knit
    ('Caramel corduroy and heavy rib knit', 'top',       'Thick wale corduroy trucker',   0.16, 0.16, 0.68, 0.34, 1),
    ('Caramel corduroy and heavy rib knit', 'accessory', 'Forest green ribbed knit',      0.28, 0.22, 0.44, 0.18, 2),
    ('Caramel corduroy and heavy rib knit', 'bottom',    'Dark brown corduroy trousers',  0.22, 0.50, 0.56, 0.32, 3),
    ('Caramel corduroy and heavy rib knit', 'shoes',     'Lug-sole dark brown boots',     0.22, 0.83, 0.56, 0.15, 4),
    ('Caramel corduroy and heavy rib knit', 'bag',       'Leather utility crossbody',     0.04, 0.35, 0.25, 0.28, 5),

    -- 10. Tiered gingham dress for a sunlit garden
    ('Tiered gingham dress for a sunlit garden', 'top',       'Gingham cotton tiered dress', 0.16, 0.16, 0.68, 0.62, 1),
    ('Tiered gingham dress for a sunlit garden', 'shoes',     'Leather Mary Jane shoes',     0.22, 0.83, 0.56, 0.15, 2),
    ('Tiered gingham dress for a sunlit garden', 'bag',       'Woven rattan basket bag',     0.04, 0.40, 0.25, 0.30, 3),
    ('Tiered gingham dress for a sunlit garden', 'accessory', 'Silk ribbon hair tie',        0.34, 0.04, 0.32, 0.08, 4),

    -- 11. Warm cinnamon knit and pleated wool skirt
    ('Warm cinnamon knit and pleated wool skirt', 'top',    'Chunky cinnamon turtleneck knit', 0.16, 0.16, 0.68, 0.34, 1),
    ('Warm cinnamon knit and pleated wool skirt', 'bottom', 'Moss green pleated maxi skirt',   0.20, 0.50, 0.60, 0.32, 2),
    ('Warm cinnamon knit and pleated wool skirt', 'shoes',  'Leather lace-up boots',           0.22, 0.83, 0.56, 0.15, 3),
    ('Warm cinnamon knit and pleated wool skirt', 'bag',    'Structured leather book bag',     0.70, 0.36, 0.25, 0.28, 4),

    -- 12. Olive trench coat and linen trousers
    ('Olive trench coat and linen trousers', 'top',       'Relaxed raglan olive trench', 0.15, 0.15, 0.70, 0.35, 1),
    ('Olive trench coat and linen trousers', 'bottom',    'Loose cream linen trousers',  0.22, 0.50, 0.56, 0.32, 2),
    ('Olive trench coat and linen trousers', 'shoes',     'Minimalist leather mules',    0.22, 0.83, 0.56, 0.15, 3),
    ('Olive trench coat and linen trousers', 'bag',       'Faded canvas shoulder pouch', 0.04, 0.36, 0.25, 0.28, 4),
    ('Olive trench coat and linen trousers', 'accessory', 'Tortoiseshell frame glasses', 0.35, 0.08, 0.30, 0.06, 5)
) AS p (title, category, label, x, y, w, h, sort_order)
JOIN outfits o ON o.title = p.title;
