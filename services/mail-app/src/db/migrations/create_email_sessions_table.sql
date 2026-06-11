CREATE TABLE email_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(30) REFERENCES users(id),
    template_id UUID REFERENCES templates(id),
    subject VARCHAR(255),
    global_variables JSONB,
    total_emails INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(50) CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_sessions_user_id ON email_sessions(user_id);
CREATE INDEX idx_email_sessions_started_at ON email_sessions(started_at DESC);
