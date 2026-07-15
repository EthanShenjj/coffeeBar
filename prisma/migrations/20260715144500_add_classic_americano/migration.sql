-- Add the classic Americano that backs the new leading menu category.
INSERT INTO "Product" (
    "id", "slug", "name", "subtitle", "description", "channel", "category",
    "basePrice", "imageUrl", "isAvailable", "stock", "sortOrder", "updatedAt"
)
VALUES (
    'seed-classic-americano',
    'classic-americano',
    '经典美式',
    '双份浓缩与纯净水，清爽平衡',
    '双份浓缩与纯净水，清爽平衡',
    'MENU',
    '美式',
    2800,
    'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=900&q=85',
    true,
    NULL,
    0,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "subtitle" = EXCLUDED."subtitle",
    "description" = EXCLUDED."description",
    "channel" = EXCLUDED."channel",
    "category" = EXCLUDED."category",
    "basePrice" = EXCLUDED."basePrice",
    "imageUrl" = EXCLUDED."imageUrl",
    "isAvailable" = EXCLUDED."isAvailable",
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ProductOptionGroup" ("id", "productId", "name", "isRequired", "minSelect", "maxSelect", "sortOrder")
VALUES
    ('seed-classic-americano-size', 'seed-classic-americano', '杯型', true, 1, 1, 0),
    ('seed-classic-americano-temp', 'seed-classic-americano', '温度', true, 1, 1, 1),
    ('seed-classic-americano-sweet', 'seed-classic-americano', '甜度', true, 1, 1, 2),
    ('seed-classic-americano-extra', 'seed-classic-americano', '加料', false, 0, 2, 3)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ProductOption" ("id", "groupId", "name", "priceDelta", "isDefault", "isAvailable", "sortOrder")
VALUES
    ('seed-classic-americano-size-m', 'seed-classic-americano-size', '中杯', 0, true, true, 0),
    ('seed-classic-americano-size-l', 'seed-classic-americano-size', '大杯', 400, false, true, 1),
    ('seed-classic-americano-hot', 'seed-classic-americano-temp', '热', 0, true, true, 0),
    ('seed-classic-americano-iced', 'seed-classic-americano-temp', '冰', 0, false, true, 1),
    ('seed-classic-americano-sweet-0', 'seed-classic-americano-sweet', '不另外加糖', 0, true, true, 0),
    ('seed-classic-americano-sweet-50', 'seed-classic-americano-sweet', '半糖', 0, false, true, 1),
    ('seed-classic-americano-sweet-100', 'seed-classic-americano-sweet', '标准糖', 0, false, true, 2),
    ('seed-classic-americano-shot', 'seed-classic-americano-extra', '加浓缩', 500, false, true, 0),
    ('seed-classic-americano-oat', 'seed-classic-americano-extra', '换燕麦奶', 400, false, true, 1)
ON CONFLICT ("id") DO NOTHING;
