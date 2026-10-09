INSERT INTO themes (slug, name, bg, surface, fg, accent, font, radius, sort_order) VALUES
    ('minimal',   'Minimal',        '#fafafa', '#ffffff', '#1c1c1c', '#1c1c1c', 'sans',    'soft',  1),
    ('soft',      'Soft Pastel',    '#fff4f6', '#ffffff', '#3d2c33', '#e58aa5', 'rounded', 'round', 2),
    ('y2k',       'Y2K',            '#eaf2ff', '#ffffff', '#1a1a4d', '#7b4dff', 'rounded', 'round', 3),
    ('vintage',   'Vintage',        '#f6ecda', '#fffaf0', '#3b2a1a', '#a4562a', 'serif',   'sharp', 4),
    ('street',    'Streetwear',     '#e9e9e9', '#ffffff', '#111111', '#ff4d00', 'sans',    'sharp', 5),
    ('editorial', 'Dark Editorial', '#141414', '#1f1f1f', '#f2efe9', '#d8b26a', 'serif',   'sharp', 6),
    ('earthy',    'Earthy Thrift',  '#f3efe4', '#fbf8f0', '#2f3a2a', '#7a8b4f', 'sans',    'soft',  7);

INSERT INTO users (username, display_name, theme_id)
SELECT u.username, u.display_name, t.id
FROM (VALUES
    ('nadyaaulia', 'Nadya Aulia',  'minimal'),
    ('rakaprata',  'Raka Pratama', 'vintage'),
    ('salsabilaf', 'Salsabila F.', 'earthy')
) AS u (username, display_name, theme)
JOIN themes t ON t.slug = u.theme;

INSERT INTO outfits (author_id, title, caption, accent, save_count, published_at)
SELECT u.id, o.title, o.caption, o.accent, o.saves, now() - o.age
FROM (VALUES
    ('nadyaaulia', 'Soft layers for a rainy campus day',
     'Comfort first: oversized shirt, wide-leg trousers, and one bright detail.', '#e8b86d', 128, interval '1 hour'),
    ('rakaprata',  'One jacket, three moods',
     'A relaxed vintage layer that works for coffee, class, and a night out.', '#8da8c7', 94, interval '2 hours'),
    ('salsabilaf', 'Everyday earth tones',
     'A calm palette for an easy, polished look without buying anything new.', '#a8a56d', 203, interval '3 hours')
) AS o (username, title, caption, accent, saves, age)
JOIN users u ON u.username = o.username;

INSERT INTO tags (normalized_name, display_name) VALUES
    ('campus', 'Campus'), ('minimal', 'Minimal'), ('rainy-day', 'Rainy day'),
    ('vintage', 'Vintage'), ('streetwear', 'Streetwear'), ('layering', 'Layering'),
    ('modest', 'Modest'), ('earth-tones', 'Earth tones'), ('everyday', 'Everyday');

INSERT INTO outfit_tags (outfit_id, tag_id)
SELECT o.id, t.id
FROM (VALUES
    ('Soft layers for a rainy campus day', 'campus'),
    ('Soft layers for a rainy campus day', 'minimal'),
    ('Soft layers for a rainy campus day', 'rainy-day'),
    ('One jacket, three moods', 'vintage'),
    ('One jacket, three moods', 'streetwear'),
    ('One jacket, three moods', 'layering'),
    ('Everyday earth tones', 'modest'),
    ('Everyday earth tones', 'earth-tones'),
    ('Everyday earth tones', 'everyday')
) AS m (title, tag)
JOIN outfits o ON o.title = m.title
JOIN tags t ON t.normalized_name = m.tag;
