-- Les zones de minage viennent uniquement des fichiers du jeu (Star Citizen Wiki, catalog.*).
-- L'ancien import JSON (relevés Regolith, service fermé) est retiré avec ses tables et ses lignes.
DROP TABLE IF EXISTS public.ore_location_ores;
DROP TABLE IF EXISTS public.ore_locations;
