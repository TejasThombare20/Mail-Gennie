CREATE TABLE email_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(30) REFERENCES users(id),
    template_id UUID REFERENCES templates(id),
    global_variables JSONB, 
    receiver_emails JSONB,  
    subject VARCHAR(255),
    status VARCHAR(50) CHECK (status IN ('sent', 'failed', 'queued', 'pending')),
    sent_at TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW()
);