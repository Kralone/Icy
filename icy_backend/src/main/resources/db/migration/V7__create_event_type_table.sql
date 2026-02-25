CREATE TABLE IF NOT EXISTS event_types (
   name VARCHAR(100) PRIMARY KEY,
   text_color VARCHAR(50),
   image_url VARCHAR(255)
);

-- Ajout d'une FK sur Event
ALTER TABLE events
    ADD COLUMN event_type VARCHAR(100),
    ADD CONSTRAINT fk_event_type FOREIGN KEY (event_type) REFERENCES event_types(name);
