CREATE TABLE attachments (
    id UUID PRIMARY KEY NOT NULL,
    user_id VARCHAR(30) REFERENCES users(id) NOT NULL,
    file_name VARCHAR(255) NOT NULL,    
    file_url TEXT NOT NULL,             
    file_type VARCHAR(50) NOT NULL,               
    file_size INT NOT NULL,     
    filepath TEXT NOT NULL,                  
    uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL, 
    expires_at TIMESTAMP NOT NULL
);