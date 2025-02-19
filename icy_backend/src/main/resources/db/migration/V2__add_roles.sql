-- Création de la table des rôles
CREATE TABLE roles (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       name VARCHAR(50) UNIQUE NOT NULL
);

-- Création de la table de liaison entre utilisateurs et rôles
CREATE TABLE user_roles (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                            role_id UUID REFERENCES roles(id) ON DELETE CASCADE
);

-- Insertion des rôles par défaut
INSERT INTO roles (name) VALUES ('ADMIN'), ('OFFICIER'), ('MEMBRE'), ('RECRUE'), ('USER'), ('BOT');


INSERT INTO users (id, username, discord_id, password, created_at)
VALUES (gen_random_uuid(), 'Kralone', 190174996235026433,
        '$2a$10$7XQjzjP7aY0sIj5s3uJbcOsOL7W2PLRgfCJzfzTPd.eBoVRoZ8U6C', CURRENT_TIMESTAMP);

-- Attribution du rôle ADMIN à l'utilisateur Kralone
INSERT INTO user_roles (id, user_id, role_id)
SELECT gen_random_uuid(), u.id, r.id FROM users u, roles r WHERE u.username = 'Kralone' AND r.name = 'ADMIN';
