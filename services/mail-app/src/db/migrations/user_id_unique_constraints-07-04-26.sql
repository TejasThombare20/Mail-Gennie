ALTER TABLE user_tokens
ADD CONSTRAINT user_tokens_user_id_unique UNIQUE (user_id);