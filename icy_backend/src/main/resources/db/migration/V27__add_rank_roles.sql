INSERT INTO core.roles (name)
VALUES ('JUNIOR'),
       ('ASSOCIE'),
       ('INGENIEUR'),
       ('SPECIALISTE'),
       ('OFFICIER'),
       ('ADMIN')
ON CONFLICT (name) DO NOTHING;
