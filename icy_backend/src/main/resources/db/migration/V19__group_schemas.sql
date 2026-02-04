-- V19__group_schemas.sql
-- Group tables by functional schemas.
-- NOTE: Moving tables out of public will require updating JPA mappings (schema=...) or connection search_path.

-- Create schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS fleet;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS goals;
CREATE SCHEMA IF NOT EXISTS collections;
CREATE SCHEMA IF NOT EXISTS recruitment;
CREATE SCHEMA IF NOT EXISTS news;
CREATE SCHEMA IF NOT EXISTS icelink;
CREATE SCHEMA IF NOT EXISTS media;
CREATE SCHEMA IF NOT EXISTS scworld;

-- Move core/auth tables
ALTER TABLE public.users SET SCHEMA core;
ALTER TABLE public.roles SET SCHEMA core;
ALTER TABLE public.user_roles SET SCHEMA core;

-- Move fleet tables
ALTER TABLE public.brand SET SCHEMA fleet;
ALTER TABLE public.ships SET SCHEMA fleet;
ALTER TABLE public.user_ships SET SCHEMA fleet;

-- Move events tables
ALTER TABLE public.event_types SET SCHEMA events;
ALTER TABLE public.events SET SCHEMA events;
ALTER TABLE public.event_participation SET SCHEMA events;

-- Move goals tables
ALTER TABLE public.goals SET SCHEMA goals;

-- Move collections tables
ALTER TABLE public.template SET SCHEMA collections;
ALTER TABLE public.user_collection SET SCHEMA collections;

-- Move recruitment tables
ALTER TABLE public.recruitment SET SCHEMA recruitment;

-- Move news tables
ALTER TABLE public.news_type SET SCHEMA news;
ALTER TABLE public.news SET SCHEMA news;

-- Move icelink tables
ALTER TABLE public.icelink_block SET SCHEMA icelink;

-- Move media tables
ALTER TABLE public.image_metadata SET SCHEMA media;

-- Move Star Citizen world event tables
ALTER TABLE public.sc_world_event_type SET SCHEMA scworld;
ALTER TABLE public.sc_world_event SET SCHEMA scworld;
ALTER TABLE public.sc_world_event_participation SET SCHEMA scworld;
