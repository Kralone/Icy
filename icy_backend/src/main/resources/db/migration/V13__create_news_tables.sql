CREATE TABLE news_type (
                           id BIGSERIAL PRIMARY KEY,
                           name VARCHAR(100) NOT NULL UNIQUE,
                           color VARCHAR(50) NOT NULL,
                           image_url TEXT
);

CREATE TABLE news (
                      id BIGSERIAL PRIMARY KEY,
                      title VARCHAR(150) NOT NULL,
                      content TEXT NOT NULL,
                      image_url VARCHAR(255),
                      type_id BIGINT NOT NULL REFERENCES news_type(id) ON DELETE CASCADE,
                      author VARCHAR(100) NOT NULL,
                      created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
