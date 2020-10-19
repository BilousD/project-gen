CREATE TABLE IF NOT EXISTS public.categories
(
    id INTEGER PRIMARY KEY,
    name varchar(64)
);
CREATE TABLE IF NOT EXISTS public.pets
(
    id INTEGER PRIMARY KEY,
    category INTEGER REFERENCES categories(id),
    name varchar(10),
    status varchar(10)
);
CREATE TABLE IF NOT EXISTS public.photo_urls
(
    id INTEGER REFERENCES pets(id),
    url VARCHAR(256)
);
CREATE TABLE IF NOT EXISTS public.tags
(
    id INTEGER PRIMARY KEY,
    name VARCHAR(64)
);
-- creating table for many-many relation
CREATE TABLE IF NOT EXISTS public.pets_tags
(
    pet_id INTEGER REFERENCES pets(id),
    tag_id INTEGER REFERENCES tags(id),
    PRIMARY KEY (pet_id, tag_id)
);
CREATE TABLE IF NOT EXISTS public.orders
(
    id INTEGER PRIMARY KEY,
    pet_id INTEGER REFERENCES pets(id),
    quantity INTEGER,
    ship_date timestamptz default now(),
    status VARCHAR(10),
    complete BOOLEAN
);