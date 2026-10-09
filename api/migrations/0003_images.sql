ALTER TABLE outfits
    ADD COLUMN image_url text CHECK (image_url IS NULL OR image_url ~ '^https://'),
    ADD COLUMN image_width int,
    ADD COLUMN image_height int;

UPDATE outfits AS o
SET image_url = v.image_url,
    image_width = v.image_width,
    image_height = v.image_height
FROM (VALUES
    ('Soft layers for a rainy campus day', 'https://picsum.photos/seed/soft-rainy-campus/600/800', 600, 800),
    ('One jacket, three moods',           'https://picsum.photos/seed/one-jacket-moods/800/1000', 800, 1000),
    ('Everyday earth tones',              'https://picsum.photos/seed/everyday-earth-tones/600/900', 600, 900)
) AS v(title, image_url, image_width, image_height)
WHERE o.title = v.title;

UPDATE users AS u
SET bio = v.bio
FROM (VALUES
    ('nadyaaulia', 'Architecture student experimenting with minimal drape, monochrome textures, and clean everyday proportions.'),
    ('rakaprata',  'Thrift archivist and musician. Living in vintage military surplus, boxy jackets, and worn-in workwear.'),
    ('salsabilaf', 'Lover of muted earth tones, linen layers, and slow fashion designed for coffee mornings.')
) AS v(username, bio)
WHERE u.username = v.username;

INSERT INTO tags (normalized_name, display_name) VALUES
    ('y2k',         'Y2K'),
    ('thrift',      'Thrift'),
    ('office',      'Office'),
    ('summer',      'Summer'),
    ('cottagecore', 'Cottagecore')
ON CONFLICT (normalized_name) DO NOTHING;

INSERT INTO outfits (author_id, title, caption, accent, save_count, published_at, image_url, image_width, image_height)
SELECT u.id, o.title, o.caption, o.accent, o.saves, now() - o.age, o.image_url, o.image_width, o.image_height
FROM (VALUES
    ('nadyaaulia', 'Charcoal tailoring for mid-week studio reviews',
     'Oversized charcoal wool blazer, cream mock-neck tee, relaxed pleated trousers, and minimal leather derbies.',
     '#3a3f47', 164, interval '1 day 6 hours', 'https://picsum.photos/seed/charcoal-studio/600/900', 600, 900),
    ('nadyaaulia', 'High-summer crisp poplin and ecru',
     'Lightweight white poplin button-down loosely tucked into ecru straight trousers with woven slides.',
     '#d9a05b', 88, interval '3 days 14 hours', 'https://picsum.photos/seed/summer-poplin/800/1000', 800, 1000),
    ('nadyaaulia', 'Cold morning library run',
     'Quilted black liner jacket over a heavyweight grey hoodie and cropped wide-leg chinos.',
     '#5b6b73', 247, interval '7 days 2 hours', 'https://picsum.photos/seed/library-quilted/600/800', 600, 800),

    ('rakaprata', 'Faded denim chore coat and 90s wash',
     'Heavily faded vintage chore jacket over a vintage white tee, washed black denim, and beaten Wallabees.',
     '#4c6e8d', 215, interval '2 days 3 hours', 'https://picsum.photos/seed/vintage-chore/600/600', 600, 600),
    ('rakaprata', 'Oversized track jacket and baggy cargos',
     'Two-tone nylon windbreaker with wide-leg technical cargo pants and chunky silver hardware.',
     '#7e57c2', 294, interval '5 days 8 hours', 'https://picsum.photos/seed/baggy-cargos/800/1000', 800, 1000),
    ('rakaprata', 'Caramel corduroy and heavy rib knit',
     'Thick wale corduroy trucker jacket paired with a forest green knit and dark brown lug-sole boots.',
     '#935116', 73, interval '8 days 18 hours', 'https://picsum.photos/seed/corduroy-rib/600/900', 600, 900),

    ('salsabilaf', 'Tiered gingham dress for a sunlit garden',
     'Soft gingham cotton dress with balloon sleeves, paired with a rattan basket and leather Mary Janes.',
     '#82954b', 198, interval '2 days 20 hours', 'https://picsum.photos/seed/gingham-garden/600/800', 600, 800),
    ('salsabilaf', 'Warm cinnamon knit and pleated wool skirt',
     'Chunky cinnamon turtleneck tucked into a moss green pleated maxi skirt for chilly bookstore afternoons.',
     '#b3541e', 142, interval '6 days 4 hours', 'https://picsum.photos/seed/cinnamon-wool/600/600', 600, 600),
    ('salsabilaf', 'Olive trench coat and linen trousers',
     'Relaxed raglan trench in faded olive draped over an oatmeal tunic and loose cream trousers.',
     '#6b705c', 56, interval '9 days 11 hours', 'https://picsum.photos/seed/olive-trench/800/1000', 800, 1000)
) AS o (username, title, caption, accent, saves, age, image_url, image_width, image_height)
JOIN users u ON u.username = o.username;

INSERT INTO outfit_tags (outfit_id, tag_id)
SELECT o.id, t.id
FROM (VALUES
    ('Charcoal tailoring for mid-week studio reviews', 'office'),
    ('Charcoal tailoring for mid-week studio reviews', 'minimal'),
    ('High-summer crisp poplin and ecru', 'summer'),
    ('High-summer crisp poplin and ecru', 'minimal'),
    ('Cold morning library run', 'campus'),
    ('Cold morning library run', 'layering'),
    ('Faded denim chore coat and 90s wash', 'thrift'),
    ('Faded denim chore coat and 90s wash', 'vintage'),
    ('Oversized track jacket and baggy cargos', 'y2k'),
    ('Oversized track jacket and baggy cargos', 'streetwear'),
    ('Caramel corduroy and heavy rib knit', 'vintage'),
    ('Caramel corduroy and heavy rib knit', 'layering'),
    ('Tiered gingham dress for a sunlit garden', 'cottagecore'),
    ('Tiered gingham dress for a sunlit garden', 'summer'),
    ('Warm cinnamon knit and pleated wool skirt', 'earth-tones'),
    ('Warm cinnamon knit and pleated wool skirt', 'modest'),
    ('Olive trench coat and linen trousers', 'modest'),
    ('Olive trench coat and linen trousers', 'everyday')
) AS m (title, tag)
JOIN outfits o ON o.title = m.title
JOIN tags t ON t.normalized_name = m.tag;
