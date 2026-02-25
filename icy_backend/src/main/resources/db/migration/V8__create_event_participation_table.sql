CREATE TABLE IF NOT EXISTS event_participation (
                                                   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                                   event_id UUID NOT NULL,
                                                   user_id UUID NOT NULL,
                                                   status INT NOT NULL CHECK (status IN (-1, 0, 1)),
                                                   UNIQUE (event_id, user_id),
                                                   FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                                                   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
