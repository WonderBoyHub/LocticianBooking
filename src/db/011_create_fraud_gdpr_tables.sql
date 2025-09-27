-- Migration 011: Fraud Detection and GDPR Compliance Tables
-- PostgreSQL 17 Security and Compliance Infrastructure
-- Created: 2025-09-26
-- Fraud detection, risk assessment, and GDPR compliance support

-- =====================================================
-- FRAUD DETECTION TABLES
-- =====================================================

-- Fraud risk assessments
CREATE TABLE fraud_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Payment details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_method VARCHAR(50),

    -- Risk assessment results
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_score DECIMAL(3,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    risk_factors JSONB,

    -- Context information
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(64),
    geographic_data JSONB,

    -- Assessment metadata
    assessment_version VARCHAR(10) DEFAULT '1.0',
    automated_decision BOOLEAN DEFAULT true,
    manual_review_required BOOLEAN DEFAULT false,
    manual_review_completed BOOLEAN DEFAULT false,
    manual_reviewer_id UUID REFERENCES users(id),

    -- Action taken
    action_taken VARCHAR(50), -- allowed, blocked, flagged, review_required
    block_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_risk_score CHECK (risk_score >= 0 AND risk_score <= 1)
);

-- Fraud patterns and rules
CREATE TABLE fraud_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Rule configuration
    rule_type VARCHAR(50) NOT NULL, -- velocity, amount, geographic, behavior
    rule_conditions JSONB NOT NULL,
    risk_score_impact DECIMAL(3,2) NOT NULL DEFAULT 0.1,

    -- Rule status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,

    -- Performance metrics
    triggers_count INTEGER DEFAULT 0,
    false_positive_count INTEGER DEFAULT 0,
    true_positive_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Suspicious activity alerts
CREATE TABLE fraud_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fraud_assessment_id UUID REFERENCES fraud_assessments(id),

    -- Alert details
    alert_type VARCHAR(50) NOT NULL, -- high_risk, velocity, suspicious_pattern
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    alert_message TEXT NOT NULL,

    -- Alert status
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    assigned_to UUID REFERENCES users(id),
    resolution_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ
);

-- Blocklist management
CREATE TABLE fraud_blocklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Blocked entity
    block_type VARCHAR(50) NOT NULL, -- ip_address, email_domain, user_agent, card_hash
    blocked_value TEXT NOT NULL,
    blocked_hash VARCHAR(64), -- For sensitive data like card numbers

    -- Block details
    reason TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('temporary', 'permanent')),
    expires_at TIMESTAMPTZ,

    -- Block statistics
    match_count INTEGER DEFAULT 0,
    last_matched_at TIMESTAMPTZ,

    -- Management
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(block_type, blocked_value)
);

-- =====================================================
-- GDPR COMPLIANCE TABLES
-- =====================================================

-- Data processing log (Article 30 compliance)
CREATE TABLE gdpr_processing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Data processing details
    data_type VARCHAR(100) NOT NULL, -- personal_data, payment_data, usage_data
    processing_purpose VARCHAR(100) NOT NULL,
    legal_basis VARCHAR(50) NOT NULL, -- consent, contract, legal_obligation, etc.
    data_categories TEXT[] NOT NULL,

    -- Processing context
    automated_decision BOOLEAN DEFAULT false,
    retention_period_days INTEGER,
    third_party_sharing BOOLEAN DEFAULT false,
    third_parties JSONB,

    -- Data location and security
    data_location VARCHAR(50) DEFAULT 'EU',
    encryption_used BOOLEAN DEFAULT true,
    anonymization_applied BOOLEAN DEFAULT false,

    -- Metadata
    metadata JSONB,
    processing_system VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Consent management
CREATE TABLE gdpr_consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Consent details
    consent_type VARCHAR(50) NOT NULL, -- marketing, analytics, payment_processing
    consent_given BOOLEAN NOT NULL,
    consent_details JSONB,

    -- Consent context
    consent_method VARCHAR(50), -- website_form, email_confirmation, api_call
    consent_version VARCHAR(10) DEFAULT '1.0',
    consent_language VARCHAR(5) DEFAULT 'da',

    -- Evidence of consent
    ip_address INET,
    user_agent TEXT,
    consent_evidence JSONB, -- Screenshots, form data, etc.

    -- Withdrawal
    withdrawn_at TIMESTAMPTZ,
    withdrawal_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ
);

-- Data subject requests (DSR)
CREATE TABLE gdpr_data_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Request details
    request_type VARCHAR(50) NOT NULL, -- access, rectification, erasure, portability, restriction
    request_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (request_status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
    request_details JSONB,

    -- Request context
    request_method VARCHAR(50), -- email, form, phone, letter
    verification_completed BOOLEAN DEFAULT false,
    verification_method VARCHAR(50),

    -- Processing
    assigned_to UUID REFERENCES users(id),
    processing_notes TEXT,
    estimated_completion_date DATE,

    -- Response
    response_provided BOOLEAN DEFAULT false,
    response_method VARCHAR(50),
    response_data JSONB,
    response_file_path TEXT,

    -- Timing (GDPR requires response within 30 days)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    deadline TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

-- Data deletion log
CREATE TABLE gdpr_deletion_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Don't use FK since user might be deleted

    -- Deletion details
    deletion_type VARCHAR(50) NOT NULL, -- partial, complete, anonymization
    deletion_scope JSONB NOT NULL,
    reason TEXT NOT NULL,

    -- Deletion process
    deletion_log JSONB NOT NULL, -- What was deleted, what was retained
    automated_deletion BOOLEAN DEFAULT false,
    manual_verification BOOLEAN DEFAULT false,

    -- Legal compliance
    retention_override BOOLEAN DEFAULT false,
    retention_reason TEXT,
    legal_basis_for_retention TEXT,

    -- Audit
    deleted_by UUID REFERENCES users(id),
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Data breach incident log
CREATE TABLE gdpr_breach_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Incident details
    incident_title VARCHAR(200) NOT NULL,
    incident_description TEXT NOT NULL,
    incident_type VARCHAR(50) NOT NULL, -- confidentiality, integrity, availability
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    -- Affected data
    affected_data_types TEXT[] NOT NULL,
    affected_users_count INTEGER DEFAULT 0,
    affected_records_count INTEGER DEFAULT 0,

    -- Incident timeline
    incident_discovered_at TIMESTAMPTZ NOT NULL,
    incident_contained_at TIMESTAMPTZ,
    incident_resolved_at TIMESTAMPTZ,

    -- Response actions
    dpa_notification_required BOOLEAN DEFAULT false,
    dpa_notification_sent_at TIMESTAMPTZ,
    user_notification_required BOOLEAN DEFAULT false,
    user_notification_sent_at TIMESTAMPTZ,

    -- Investigation
    root_cause TEXT,
    corrective_actions TEXT,
    preventive_measures TEXT,

    -- Management
    incident_manager UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'contained', 'resolved', 'closed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Privacy Impact Assessments (PIA/DPIA)
CREATE TABLE gdpr_privacy_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Assessment details
    assessment_title VARCHAR(200) NOT NULL,
    assessment_description TEXT NOT NULL,
    processing_activity VARCHAR(100) NOT NULL,

    -- Risk assessment
    privacy_risks JSONB NOT NULL,
    risk_mitigation_measures JSONB,
    residual_risk_level VARCHAR(20) CHECK (residual_risk_level IN ('low', 'medium', 'high')),

    -- Legal compliance
    legal_basis VARCHAR(50) NOT NULL,
    consultation_with_dpo BOOLEAN DEFAULT false,
    dpo_opinion TEXT,

    -- Assessment status
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approval_date DATE,

    -- Validity
    valid_from DATE NOT NULL,
    valid_until DATE,
    review_frequency_months INTEGER DEFAULT 12,
    next_review_date DATE,

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SECURITY MONITORING TABLES
-- =====================================================

-- Security events log
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Event details
    event_type VARCHAR(50) NOT NULL, -- login_failed, suspicious_payment, fraud_detected
    event_severity VARCHAR(20) NOT NULL CHECK (event_severity IN ('info', 'warning', 'error', 'critical')),
    event_description TEXT NOT NULL,

    -- Context
    ip_address INET,
    user_agent TEXT,
    request_path TEXT,
    request_method VARCHAR(10),
    response_status INTEGER,

    -- Security analysis
    is_threat BOOLEAN DEFAULT false,
    threat_score DECIMAL(3,2), -- 0.0 to 1.0
    automated_response VARCHAR(50), -- blocked, flagged, allowed

    -- Metadata
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting violations
CREATE TABLE rate_limit_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Violation details
    endpoint VARCHAR(200) NOT NULL,
    limit_type VARCHAR(50) NOT NULL, -- per_minute, per_hour, per_day
    limit_value INTEGER NOT NULL,
    actual_requests INTEGER NOT NULL,

    -- Context
    ip_address INET NOT NULL,
    user_agent TEXT,
    time_window_start TIMESTAMPTZ NOT NULL,
    time_window_end TIMESTAMPTZ NOT NULL,

    -- Response
    action_taken VARCHAR(50), -- blocked, throttled, logged
    block_duration_minutes INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE AND QUERIES
-- =====================================================

-- Fraud detection indexes
CREATE INDEX idx_fraud_assessments_user_time ON fraud_assessments (user_id, created_at DESC);
CREATE INDEX idx_fraud_assessments_risk ON fraud_assessments (risk_level, risk_score DESC);
CREATE INDEX idx_fraud_assessments_ip ON fraud_assessments (ip_address, created_at DESC);
CREATE INDEX idx_fraud_assessments_action ON fraud_assessments (action_taken, created_at DESC);

-- Fraud rules indexes
CREATE INDEX idx_fraud_rules_active ON fraud_rules (is_active, priority) WHERE is_active = true;
CREATE INDEX idx_fraud_rules_type ON fraud_rules (rule_type, is_active);

-- Fraud alerts indexes
CREATE INDEX idx_fraud_alerts_status ON fraud_alerts (status, severity, created_at DESC);
CREATE INDEX idx_fraud_alerts_user ON fraud_alerts (user_id, created_at DESC);
CREATE INDEX idx_fraud_alerts_assigned ON fraud_alerts (assigned_to, status) WHERE assigned_to IS NOT NULL;

-- Blocklist indexes
CREATE INDEX idx_fraud_blocklist_type_value ON fraud_blocklist (block_type, blocked_value);
CREATE INDEX idx_fraud_blocklist_hash ON fraud_blocklist (blocked_hash) WHERE blocked_hash IS NOT NULL;
CREATE INDEX idx_fraud_blocklist_expires ON fraud_blocklist (expires_at) WHERE expires_at IS NOT NULL;

-- GDPR processing log indexes
CREATE INDEX idx_gdpr_processing_user_time ON gdpr_processing_log (user_id, created_at DESC);
CREATE INDEX idx_gdpr_processing_type ON gdpr_processing_log (data_type, processing_purpose);
CREATE INDEX idx_gdpr_processing_basis ON gdpr_processing_log (legal_basis, created_at DESC);

-- GDPR consent indexes
CREATE INDEX idx_gdpr_consent_user_type ON gdpr_consent_records (user_id, consent_type, created_at DESC);
CREATE INDEX idx_gdpr_consent_status ON gdpr_consent_records (consent_given, consent_type);
CREATE INDEX idx_gdpr_consent_expires ON gdpr_consent_records (expires_at) WHERE expires_at IS NOT NULL;

-- GDPR requests indexes
CREATE INDEX idx_gdpr_requests_user_status ON gdpr_data_requests (user_id, request_status, created_at DESC);
CREATE INDEX idx_gdpr_requests_deadline ON gdpr_data_requests (deadline, request_status) WHERE request_status IN ('pending', 'processing');
CREATE INDEX idx_gdpr_requests_assigned ON gdpr_data_requests (assigned_to, request_status) WHERE assigned_to IS NOT NULL;

-- Security events indexes
CREATE INDEX idx_security_events_type_time ON security_events (event_type, created_at DESC);
CREATE INDEX idx_security_events_severity ON security_events (event_severity, created_at DESC);
CREATE INDEX idx_security_events_user_time ON security_events (user_id, created_at DESC);
CREATE INDEX idx_security_events_ip ON security_events (ip_address, created_at DESC);
CREATE INDEX idx_security_events_threat ON security_events (is_threat, threat_score DESC) WHERE is_threat = true;

-- Rate limiting indexes
CREATE INDEX idx_rate_limit_violations_ip ON rate_limit_violations (ip_address, created_at DESC);
CREATE INDEX idx_rate_limit_violations_user ON rate_limit_violations (user_id, created_at DESC);
CREATE INDEX idx_rate_limit_violations_endpoint ON rate_limit_violations (endpoint, created_at DESC);

-- =====================================================
-- TRIGGERS AND AUTOMATION
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER update_fraud_rules_updated_at
    BEFORE UPDATE ON fraud_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fraud_blocklist_updated_at
    BEFORE UPDATE ON fraud_blocklist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gdpr_breach_incidents_updated_at
    BEFORE UPDATE ON gdpr_breach_incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gdpr_privacy_assessments_updated_at
    BEFORE UPDATE ON gdpr_privacy_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-expire consent trigger
CREATE OR REPLACE FUNCTION check_expired_consents()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark expired consents as withdrawn
    UPDATE gdpr_consent_records
    SET withdrawn_at = NOW(),
        withdrawal_reason = 'Automatic expiration'
    WHERE expires_at < NOW()
    AND withdrawn_at IS NULL
    AND consent_given = true;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a job to check expired consents daily
CREATE OR REPLACE FUNCTION schedule_consent_expiration_check()
RETURNS VOID AS $$
BEGIN
    -- This would typically be handled by a job scheduler
    -- For demonstration, we'll create a function that can be called
    PERFORM check_expired_consents();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GDPR COMPLIANCE FUNCTIONS
-- =====================================================

-- Function to check GDPR request deadlines
CREATE OR REPLACE FUNCTION check_gdpr_request_deadlines()
RETURNS TABLE(
    request_id UUID,
    user_email TEXT,
    request_type VARCHAR(50),
    days_until_deadline INTEGER,
    overdue BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        gdr.id,
        u.email,
        gdr.request_type,
        EXTRACT(DAYS FROM (gdr.deadline - CURRENT_TIMESTAMP))::INTEGER,
        gdr.deadline < CURRENT_TIMESTAMP
    FROM gdpr_data_requests gdr
    JOIN users u ON gdr.user_id = u.id
    WHERE gdr.request_status IN ('pending', 'processing')
    ORDER BY gdr.deadline;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to anonymize user data
CREATE OR REPLACE FUNCTION anonymize_user_gdpr(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    deletion_log JSONB;
BEGIN
    -- Create anonymization log
    deletion_log := jsonb_build_object(
        'user_id', user_uuid,
        'anonymized_at', CURRENT_TIMESTAMP,
        'anonymized_tables', ARRAY[]::TEXT[]
    );

    -- Anonymize user data
    UPDATE users SET
        email = 'deleted-' || user_uuid || '@anonymized.local',
        phone = NULL,
        first_name = 'Deleted',
        last_name = 'User',
        date_of_birth = NULL,
        street_address = NULL,
        city = NULL,
        postal_code = NULL,
        deleted_at = CURRENT_TIMESTAMP
    WHERE id = user_uuid;

    deletion_log := jsonb_set(deletion_log, '{anonymized_tables}',
        deletion_log->'anonymized_tables' || '"users"'::jsonb);

    -- Anonymize profile data
    UPDATE user_profiles SET
        bio = 'Profile anonymized',
        profile_image_url = NULL,
        instagram_handle = NULL,
        website_url = NULL,
        allergies = NULL,
        notes = 'Data anonymized for GDPR compliance'
    WHERE user_id = user_uuid;

    deletion_log := jsonb_set(deletion_log, '{anonymized_tables}',
        deletion_log->'anonymized_tables' || '"user_profiles"'::jsonb);

    -- Anonymize booking customer data (keep transaction records for legal compliance)
    UPDATE bookings SET
        customer_notes = 'Customer data anonymized',
        special_requests = NULL
    WHERE customer_id = user_uuid;

    deletion_log := jsonb_set(deletion_log, '{anonymized_tables}',
        deletion_log->'anonymized_tables' || '"bookings"'::jsonb);

    -- Log the anonymization
    INSERT INTO gdpr_deletion_log (
        user_id, deletion_type, deletion_scope, reason, deletion_log, automated_deletion
    ) VALUES (
        user_uuid, 'anonymization', deletion_log, 'GDPR right to erasure', deletion_log, true
    );

    RETURN deletion_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FRAUD DETECTION FUNCTIONS
-- =====================================================

-- Function to check if entity is blocklisted
CREATE OR REPLACE FUNCTION is_blocklisted(
    block_type_param VARCHAR(50),
    value_to_check TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    is_blocked BOOLEAN := false;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM fraud_blocklist
        WHERE block_type = block_type_param
        AND blocked_value = value_to_check
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ) INTO is_blocked;

    -- Update match statistics if blocked
    IF is_blocked THEN
        UPDATE fraud_blocklist
        SET match_count = match_count + 1,
            last_matched_at = CURRENT_TIMESTAMP
        WHERE block_type = block_type_param
        AND blocked_value = value_to_check;
    END IF;

    RETURN is_blocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add to blocklist
CREATE OR REPLACE FUNCTION add_to_blocklist(
    block_type_param VARCHAR(50),
    value_to_block TEXT,
    reason_param TEXT,
    severity_param VARCHAR(20) DEFAULT 'permanent',
    expires_in_days INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    expires_date TIMESTAMPTZ := NULL;
BEGIN
    IF expires_in_days IS NOT NULL THEN
        expires_date := CURRENT_TIMESTAMP + (expires_in_days || ' days')::INTERVAL;
    END IF;

    INSERT INTO fraud_blocklist (
        block_type, blocked_value, reason, severity, expires_at
    ) VALUES (
        block_type_param, value_to_block, reason_param, severity_param, expires_date
    )
    ON CONFLICT (block_type, blocked_value)
    DO UPDATE SET
        reason = EXCLUDED.reason,
        severity = EXCLUDED.severity,
        expires_at = EXCLUDED.expires_at,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEWS FOR COMPLIANCE MONITORING
-- =====================================================

-- GDPR compliance dashboard view
CREATE VIEW v_gdpr_compliance_dashboard AS
SELECT
    'Pending Data Requests' as metric,
    COUNT(*)::TEXT as value,
    'requests' as unit
FROM gdpr_data_requests
WHERE request_status IN ('pending', 'processing')

UNION ALL

SELECT
    'Overdue Requests' as metric,
    COUNT(*)::TEXT as value,
    'requests' as unit
FROM gdpr_data_requests
WHERE deadline < CURRENT_TIMESTAMP
AND request_status IN ('pending', 'processing')

UNION ALL

SELECT
    'Users Without Consent' as metric,
    COUNT(*)::TEXT as value,
    'users' as unit
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM gdpr_consent_records gcr
    WHERE gcr.user_id = u.id
    AND gcr.consent_type = 'gdpr_processing'
    AND gcr.consent_given = true
    AND gcr.withdrawn_at IS NULL
)
AND u.deleted_at IS NULL

UNION ALL

SELECT
    'Active Security Alerts' as metric,
    COUNT(*)::TEXT as value,
    'alerts' as unit
FROM fraud_alerts
WHERE status = 'open'

UNION ALL

SELECT
    'High Risk Transactions (24h)' as metric,
    COUNT(*)::TEXT as value,
    'transactions' as unit
FROM fraud_assessments
WHERE risk_level IN ('high', 'critical')
AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours';

-- Fraud monitoring dashboard view
CREATE VIEW v_fraud_monitoring_dashboard AS
SELECT
    fa.risk_level,
    COUNT(*) as assessment_count,
    AVG(fa.risk_score) as avg_risk_score,
    COUNT(CASE WHEN fa.action_taken = 'blocked' THEN 1 END) as blocked_count,
    COUNT(CASE WHEN fa.manual_review_required THEN 1 END) as review_required_count
FROM fraud_assessments fa
WHERE fa.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY fa.risk_level
ORDER BY
    CASE fa.risk_level
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON TABLE fraud_assessments IS 'Risk assessments for payment transactions and user activities';
COMMENT ON TABLE fraud_rules IS 'Configurable fraud detection rules and patterns';
COMMENT ON TABLE fraud_alerts IS 'Security alerts for suspicious activities requiring investigation';
COMMENT ON TABLE fraud_blocklist IS 'Blocked entities (IPs, emails, etc.) for fraud prevention';

COMMENT ON TABLE gdpr_processing_log IS 'Article 30 GDPR compliance log of all data processing activities';
COMMENT ON TABLE gdpr_consent_records IS 'User consent records with evidence for GDPR compliance';
COMMENT ON TABLE gdpr_data_requests IS 'Data subject requests (access, deletion, etc.) tracking';
COMMENT ON TABLE gdpr_deletion_log IS 'Log of data deletions and anonymizations';
COMMENT ON TABLE gdpr_breach_incidents IS 'Data breach incident tracking and response';
COMMENT ON TABLE gdpr_privacy_assessments IS 'Privacy Impact Assessments (DPIA) for high-risk processing';

COMMENT ON TABLE security_events IS 'Security event logging for monitoring and analysis';
COMMENT ON TABLE rate_limit_violations IS 'Rate limiting violations for abuse prevention';

COMMENT ON FUNCTION is_blocklisted IS 'Check if an entity is on the fraud blocklist';
COMMENT ON FUNCTION add_to_blocklist IS 'Add an entity to the fraud blocklist';
COMMENT ON FUNCTION anonymize_user_gdpr IS 'Anonymize user data for GDPR right to erasure';
COMMENT ON FUNCTION check_gdpr_request_deadlines IS 'Monitor GDPR data request deadlines';