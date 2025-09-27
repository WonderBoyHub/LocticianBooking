-- =====================================================
-- SAMPLE DATA FOR LOCTICIAN BOOKING SYSTEM
-- =====================================================
-- This file contains comprehensive sample data for testing
-- the booking system functionality
-- =====================================================

-- Clear existing data (use with caution in production!)
-- TRUNCATE TABLE booking_state_changes, booking_products, booking_services,
-- bookings, calendar_events, availability_overrides, availability_patterns,
-- email_queue, email_templates, instagram_posts, media_files, cms_pages,
-- products, services, service_categories, user_profiles, users CASCADE;

-- =====================================================
-- SERVICE CATEGORIES
-- =====================================================

INSERT INTO service_categories (id, name, description, display_order) VALUES
(uuid_generate_v4(), 'Loc Maintenance', 'Regular maintenance services for healthy locs', 1),
(uuid_generate_v4(), 'Loc Styling', 'Creative styling and artistic loc arrangements', 2),
(uuid_generate_v4(), 'Loc Repair', 'Repair and restoration services for damaged locs', 3),
(uuid_generate_v4(), 'New Loc Installation', 'Starting your loc journey with professional installation', 4),
(uuid_generate_v4(), 'Consultations', 'Professional advice and planning sessions', 5);

-- =====================================================
-- SERVICES
-- =====================================================

WITH categories AS (
    SELECT id, name FROM service_categories
)
INSERT INTO services (id, category_id, name, description, duration_minutes, base_price, min_advance_hours, buffer_before_minutes, buffer_after_minutes, slug) VALUES
-- Loc Maintenance Services
(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Loc Maintenance'),
 'Loc Retwist',
 'Professional root maintenance and retwisting for healthy loc growth',
 90, 450.00, 24, 15, 15, 'loc-retwist'),

(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Loc Maintenance'),
 'Loc Wash & Style',
 'Deep cleansing wash with natural products followed by styling',
 120, 350.00, 24, 15, 15, 'loc-wash-style'),

(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Loc Maintenance'),
 'Root Maintenance Only',
 'Quick root touch-up between full maintenance sessions',
 60, 250.00, 12, 10, 10, 'root-maintenance'),

-- Loc Styling Services
(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Loc Styling'),
 'Protective Styling',
 'Beautiful protective styles to keep your locs healthy and elegant',
 150, 500.00, 48, 20, 20, 'protective-styling'),

(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Loc Styling'),
 'Loc Updo',
 'Elegant updos perfect for special occasions and events',
 75, 300.00, 24, 15, 15, 'loc-updo'),

(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Loc Styling'),
 'Braided Loc Style',
 'Creative braided arrangements incorporating your natural locs',
 120, 400.00, 24, 15, 15, 'braided-loc-style'),

-- Loc Repair Services
(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Loc Repair'),
 'Loc Repair & Restoration',
 'Professional repair for broken, thinning, or damaged locs',
 180, 600.00, 72, 30, 30, 'loc-repair-restoration'),

(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Loc Repair'),
 'Loc Combination',
 'Combining two or more locs to create fuller, healthier locs',
 120, 400.00, 48, 20, 20, 'loc-combination'),

-- New Loc Installation
(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'New Loc Installation'),
 'Two-Strand Twist Starter Locs',
 'Professional installation of starter locs using two-strand twist method',
 240, 800.00, 168, 30, 30, 'two-strand-twist-starter'),

(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'New Loc Installation'),
 'Comb Coil Starter Locs',
 'Professional installation using the comb coil technique',
 210, 750.00, 168, 30, 30, 'comb-coil-starter'),

-- Consultations
(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Consultations'),
 'Loc Consultation',
 'Comprehensive consultation to plan your loc journey',
 45, 100.00, 24, 10, 10, 'loc-consultation'),

(uuid_generate_v4(),
 (SELECT id FROM categories WHERE name = 'Consultations'),
 'Hair Health Assessment',
 'Professional assessment of hair and scalp health',
 30, 75.00, 12, 10, 10, 'hair-health-assessment');

-- =====================================================
-- PRODUCT CATEGORIES
-- =====================================================

INSERT INTO product_categories (id, name, description, display_order) VALUES
(uuid_generate_v4(), 'Loc Care Products', 'Essential products for healthy loc maintenance', 1),
(uuid_generate_v4(), 'Natural Oils', 'Pure oils for nourishing locs and scalp', 2),
(uuid_generate_v4(), 'Styling Products', 'Products for styling and holding loc arrangements', 3),
(uuid_generate_v4(), 'Tools & Accessories', 'Professional tools and accessories for loc care', 4);

-- =====================================================
-- PRODUCTS
-- =====================================================

WITH prod_categories AS (
    SELECT id, name FROM product_categories
)
INSERT INTO products (id, category_id, name, description, sku, price, cost_price, stock_quantity, brand, size) VALUES
-- Loc Care Products
(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Loc Care Products'),
 'Organic Loc Shampoo',
 'Gentle, sulfate-free shampoo specially formulated for locs',
 'OLS-250', 185.00, 90.00, 45, 'Pure Locs', '250ml'),

(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Loc Care Products'),
 'Deep Conditioning Treatment',
 'Intensive conditioning treatment for dry and damaged locs',
 'DCT-200', 220.00, 110.00, 32, 'Loc Love', '200ml'),

(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Loc Care Products'),
 'Residue Removing Rinse',
 'Clarifying rinse to remove buildup without stripping natural oils',
 'RRR-300', 165.00, 80.00, 28, 'Clean Locs', '300ml'),

-- Natural Oils
(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Natural Oils'),
 'Organic Jojoba Oil',
 'Pure jojoba oil for moisturizing locs and scalp',
 'OJO-50', 145.00, 70.00, 25, 'Nature''s Best', '50ml'),

(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Natural Oils'),
 'Rosemary Essential Oil Blend',
 'Stimulating rosemary blend to promote healthy growth',
 'REB-30', 125.00, 60.00, 20, 'Herbal Essence', '30ml'),

(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Natural Oils'),
 'Coconut Oil Treatment',
 'Virgin coconut oil for deep moisturizing treatment',
 'COT-100', 95.00, 45.00, 35, 'Tropical Care', '100ml'),

-- Styling Products
(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Styling Products'),
 'Natural Hold Gel',
 'Alcohol-free gel for styling without buildup',
 'NHG-150', 135.00, 65.00, 40, 'Loc Style', '150ml'),

(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Styling Products'),
 'Loc Butter',
 'Rich butter blend for shine and moisture retention',
 'LB-100', 155.00, 75.00, 30, 'Butter Locs', '100ml'),

-- Tools & Accessories
(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Tools & Accessories'),
 'Professional Loc Comb',
 'Precision comb designed specifically for loc maintenance',
 'PLC-001', 85.00, 40.00, 15, 'Loc Tools Pro', 'Standard'),

(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Tools & Accessories'),
 'Silk Loc Scarf',
 'Premium silk scarf for protecting locs while sleeping',
 'SLS-001', 195.00, 95.00, 22, 'Silk Dreams', 'One Size'),

(uuid_generate_v4(),
 (SELECT id FROM prod_categories WHERE name = 'Tools & Accessories'),
 'Wooden Hair Pins Set',
 'Set of 12 wooden pins for secure and gentle styling',
 'WHP-012', 65.00, 30.00, 18, 'Natural Style', 'Set of 12');

-- =====================================================
-- USERS (CUSTOMERS AND LOCTICIANS)
-- =====================================================

-- Sample Admin User
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, status, gdpr_consent_date, gdpr_consent_version) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@loctician.dk', '$2b$12$LQv3c1yqBwEHXw+YfklhquY4EDSyRF6bX8Kqj8Lx8r0K2+jUPxB/G', 'admin', 'System', 'Administrator', '+45 12 34 56 78', 'active', NOW(), '1.0');

-- Sample Loctician
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, street_address, city, postal_code, status, gdpr_consent_date, gdpr_consent_version) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'maria@loctician.dk', '$2b$12$LQv3c1yqBwEHXw+YfklhquY4EDSyRF6bX8Kqj8Lx8r0K2+jUPxB/G', 'loctician', 'Maria', 'Andersen', '+45 20 30 40 50', 'Nørrebrogade 123', 'København N', '2200', 'active', NOW(), '1.0'),
('550e8400-e29b-41d4-a716-446655440002', 'lars@loctician.dk', '$2b$12$LQv3c1yqBwEHXw+YfklhquY4EDSyRF6bX8Kqj8Lx8r0K2+jUPxB/G', 'loctician', 'Lars', 'Nielsen', '+45 30 40 50 60', 'Vesterbrogade 456', 'København V', '1620', 'active', NOW(), '1.0');

-- Sample Customers
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, street_address, city, postal_code, status, marketing_consent, gdpr_consent_date, gdpr_consent_version, data_retention_until) VALUES
('550e8400-e29b-41d4-a716-446655440010', 'anna@email.dk', '$2b$12$LQv3c1yqBwEHXw+YfklhquY4EDSyRF6bX8Kqj8Lx8r0K2+jUPxB/G', 'customer', 'Anna', 'Jensen', '+45 40 50 60 70', 'Østerbrogade 789', 'København Ø', '2100', 'active', true, NOW(), '1.0', NOW() + INTERVAL '3 years'),
('550e8400-e29b-41d4-a716-446655440011', 'peter@email.dk', '$2b$12$LQv3c1yqBwEHXw+YfklhquY4EDSyRF6bX8Kqj8Lx8r0K2+jUPxB/G', 'customer', 'Peter', 'Larsen', '+45 50 60 70 80', 'Amagerbrogade 321', 'København S', '2300', 'active', false, NOW(), '1.0', NOW() + INTERVAL '3 years'),
('550e8400-e29b-41d4-a716-446655440012', 'sofie@email.dk', '$2b$12$LQv3c1yqBwEHXw+YfklhquY4EDSyRF6bX8Kqj8Lx8r0K2+jUPxB/G', 'customer', 'Sofie', 'Hansen', '+45 60 70 80 90', 'Frederiksberg Allé 654', 'Frederiksberg', '2000', 'active', true, NOW(), '1.0', NOW() + INTERVAL '3 years'),
('550e8400-e29b-41d4-a716-446655440013', 'mikkel@email.dk', '$2b$12$LQv3c1yqBwEHXw+YfklhquY4EDSyRF6bX8Kqj8Lx8r0K2+jUPxB/G', 'customer', 'Mikkel', 'Thomsen', '+45 70 80 90 10', 'Strøget 987', 'København K', '1150', 'active', true, NOW(), '1.0', NOW() + INTERVAL '3 years');

-- =====================================================
-- USER PROFILES
-- =====================================================

-- Loctician Profiles
INSERT INTO user_profiles (user_id, bio, specializations, years_experience, certifications, hair_type, business_hours) VALUES
('550e8400-e29b-41d4-a716-446655440001',
 'Passionate loctician with over 8 years of experience in natural hair care. Specializing in healthy loc maintenance and artistic styling.',
 ARRAY['Loc Maintenance', 'Protective Styling', 'Natural Hair Care'],
 8,
 ARRAY['Certified Natural Hair Specialist', 'Loc Maintenance Expert'],
 NULL,
 '{"monday": {"start": "09:00", "end": "17:00"}, "tuesday": {"start": "09:00", "end": "17:00"}, "wednesday": {"start": "10:00", "end": "18:00"}, "thursday": {"start": "09:00", "end": "17:00"}, "friday": {"start": "09:00", "end": "16:00"}, "saturday": {"start": "10:00", "end": "15:00"}}'),

('550e8400-e29b-41d4-a716-446655440002',
 'Expert in loc installation and repair with focus on scalp health and sustainable practices.',
 ARRAY['Loc Installation', 'Loc Repair', 'Scalp Health'],
 12,
 ARRAY['Master Loctician Certification', 'Trichology Diploma'],
 NULL,
 '{"monday": {"start": "08:00", "end": "16:00"}, "tuesday": {"start": "08:00", "end": "16:00"}, "wednesday": {"start": "08:00", "end": "16:00"}, "thursday": {"start": "08:00", "end": "16:00"}, "friday": {"start": "08:00", "end": "15:00"}}');

-- Customer Profiles
INSERT INTO user_profiles (user_id, hair_type, hair_length, allergies, notes) VALUES
('550e8400-e29b-41d4-a716-446655440010', '4C', 'shoulder-length', ARRAY['sulfates'], 'Prefers organic products only'),
('550e8400-e29b-41d4-a716-446655440011', '4B', 'medium', NULL, 'Regular maintenance customer'),
('550e8400-e29b-41d4-a716-446655440012', '4A', 'long', ARRAY['fragrances', 'parabens'], 'Sensitive scalp - needs gentle products'),
('550e8400-e29b-41d4-a716-446655440013', '4C', 'short', NULL, 'New to locs - needs education and guidance');

-- =====================================================
-- AVAILABILITY PATTERNS
-- =====================================================

-- Maria's availability (Monday-Saturday)
INSERT INTO availability_patterns (loctician_id, day_of_week, start_time, end_time, effective_from) VALUES
('550e8400-e29b-41d4-a716-446655440001', 1, '09:00', '17:00', CURRENT_DATE - INTERVAL '30 days'), -- Monday
('550e8400-e29b-41d4-a716-446655440001', 2, '09:00', '17:00', CURRENT_DATE - INTERVAL '30 days'), -- Tuesday
('550e8400-e29b-41d4-a716-446655440001', 3, '10:00', '18:00', CURRENT_DATE - INTERVAL '30 days'), -- Wednesday
('550e8400-e29b-41d4-a716-446655440001', 4, '09:00', '17:00', CURRENT_DATE - INTERVAL '30 days'), -- Thursday
('550e8400-e29b-41d4-a716-446655440001', 5, '09:00', '16:00', CURRENT_DATE - INTERVAL '30 days'), -- Friday
('550e8400-e29b-41d4-a716-446655440001', 6, '10:00', '15:00', CURRENT_DATE - INTERVAL '30 days'); -- Saturday

-- Lars's availability (Monday-Friday)
INSERT INTO availability_patterns (loctician_id, day_of_week, start_time, end_time, effective_from) VALUES
('550e8400-e29b-41d4-a716-446655440002', 1, '08:00', '16:00', CURRENT_DATE - INTERVAL '30 days'), -- Monday
('550e8400-e29b-41d4-a716-446655440002', 2, '08:00', '16:00', CURRENT_DATE - INTERVAL '30 days'), -- Tuesday
('550e8400-e29b-41d4-a716-446655440002', 3, '08:00', '16:00', CURRENT_DATE - INTERVAL '30 days'), -- Wednesday
('550e8400-e29b-41d4-a716-446655440002', 4, '08:00', '16:00', CURRENT_DATE - INTERVAL '30 days'), -- Thursday
('550e8400-e29b-41d4-a716-446655440002', 5, '08:00', '15:00', CURRENT_DATE - INTERVAL '30 days'); -- Friday

-- =====================================================
-- SAMPLE BOOKINGS
-- =====================================================

-- Get service IDs for bookings
WITH service_ids AS (
    SELECT id, name, duration_minutes, base_price FROM services
)
INSERT INTO bookings (
    id, booking_number, customer_id, loctician_id, service_id,
    appointment_start, appointment_end, duration_minutes,
    service_price, total_amount, status, customer_notes
) VALUES
-- Past completed bookings
('550e8400-e29b-41d4-a716-446655440100', 'BK20240915001',
 '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001',
 (SELECT id FROM service_ids WHERE name = 'Loc Retwist'),
 '2024-09-15 10:00:00+02', '2024-09-15 11:30:00+02', 90,
 450.00, 450.00, 'completed', 'First time client - please take extra care'),

('550e8400-e29b-41d4-a716-446655440101', 'BK20240918002',
 '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440002',
 (SELECT id FROM service_ids WHERE name = 'Loc Wash & Style'),
 '2024-09-18 14:00:00+02', '2024-09-18 16:00:00+02', 120,
 350.00, 350.00, 'completed', 'Regular customer'),

-- Upcoming confirmed bookings
('550e8400-e29b-41d4-a716-446655440102', 'BK20240925003',
 '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001',
 (SELECT id FROM service_ids WHERE name = 'Protective Styling'),
 '2024-09-25 11:00:00+02', '2024-09-25 13:30:00+02', 150,
 500.00, 500.00, 'confirmed', 'Wedding guest - needs elegant updo style'),

('550e8400-e29b-41d4-a716-446655440103', 'BK20240926004',
 '550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002',
 (SELECT id FROM service_ids WHERE name = 'Loc Consultation'),
 '2024-09-26 09:00:00+02', '2024-09-26 09:45:00+02', 45,
 100.00, 100.00, 'confirmed', 'Interested in starting loc journey'),

('550e8400-e29b-41d4-a716-446655440104', 'BK20240927005',
 '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001',
 (SELECT id FROM service_ids WHERE name = 'Root Maintenance Only'),
 '2024-09-27 15:00:00+02', '2024-09-27 16:00:00+02', 60,
 250.00, 250.00, 'confirmed', 'Quick touch-up before weekend plans');

-- =====================================================
-- EMAIL TEMPLATES
-- =====================================================

INSERT INTO email_templates (name, template_type, subject, html_content, text_content, available_variables) VALUES
('Booking Confirmation', 'booking_confirmation',
 'Booking Confirmed - {{booking_number}}',
 '<h2>Booking Confirmed</h2>
  <p>Dear {{customer_name}},</p>
  <p>Your appointment has been confirmed:</p>
  <ul>
    <li><strong>Service:</strong> {{service_name}}</li>
    <li><strong>Date & Time:</strong> {{appointment_date}} at {{appointment_time}}</li>
    <li><strong>Duration:</strong> {{duration}} minutes</li>
    <li><strong>Loctician:</strong> {{loctician_name}}</li>
    <li><strong>Total:</strong> {{total_amount}} DKK</li>
  </ul>
  <p>Please arrive 15 minutes early.</p>
  <p>Best regards,<br>{{business_name}}</p>',
 'Booking Confirmed - {{booking_number}}

Dear {{customer_name}},

Your appointment has been confirmed:
- Service: {{service_name}}
- Date & Time: {{appointment_date}} at {{appointment_time}}
- Duration: {{duration}} minutes
- Loctician: {{loctician_name}}
- Total: {{total_amount}} DKK

Please arrive 15 minutes early.

Best regards,
{{business_name}}',
 '{"customer_name": "Customer full name", "booking_number": "Booking reference", "service_name": "Name of booked service", "appointment_date": "Date of appointment", "appointment_time": "Time of appointment", "duration": "Service duration in minutes", "loctician_name": "Loctician full name", "total_amount": "Total price", "business_name": "Business name"}'),

('Appointment Reminder', 'reminder',
 'Reminder: Your appointment tomorrow - {{booking_number}}',
 '<h2>Appointment Reminder</h2>
  <p>Dear {{customer_name}},</p>
  <p>This is a friendly reminder about your appointment tomorrow:</p>
  <ul>
    <li><strong>Service:</strong> {{service_name}}</li>
    <li><strong>Date & Time:</strong> {{appointment_date}} at {{appointment_time}}</li>
    <li><strong>Loctician:</strong> {{loctician_name}}</li>
  </ul>
  <p>Please arrive 15 minutes early and bring any special products if discussed.</p>
  <p>Looking forward to seeing you!</p>
  <p>Best regards,<br>{{business_name}}</p>',
 'Appointment Reminder

Dear {{customer_name}},

This is a friendly reminder about your appointment tomorrow:
- Service: {{service_name}}
- Date & Time: {{appointment_date}} at {{appointment_time}}
- Loctician: {{loctician_name}}

Please arrive 15 minutes early and bring any special products if discussed.

Looking forward to seeing you!

Best regards,
{{business_name}}',
 '{"customer_name": "Customer full name", "booking_number": "Booking reference", "service_name": "Name of booked service", "appointment_date": "Date of appointment", "appointment_time": "Time of appointment", "loctician_name": "Loctician full name", "business_name": "Business name"}');

-- =====================================================
-- CMS CONTENT
-- =====================================================

INSERT INTO cms_pages (title, slug, content, page_type, is_published, published_at, meta_title, meta_description) VALUES
('Om Os', 'om-os',
 '<h1>Velkommen til Vores Loctician Studio</h1>
  <p>Vi er specialister i naturlig hårpleje med fokus på locs og beskyttende frisurer. Med over 10 års erfaring hjælper vi dig med at opnå sunde, smukke locs der afspejler din personlige stil.</p>

  <h2>Vores Filosofi</h2>
  <p>Vi tror på, at sundt hår starter med en sund hovedbund og naturlige produkter. Vores tilgang er holistisk - vi ser på dit hår, din livsstil og dine ønsker for at skabe den bedste plan for dine locs.</p>

  <h2>Vores Services</h2>
  <ul>
    <li>Professionel loc installation</li>
    <li>Regelmæssig loc vedligeholdelse</li>
    <li>Reparation af beskadigede locs</li>
    <li>Kreativ styling til alle lejligheder</li>
    <li>Rådgivning om hjemmepleje</li>
  </ul>',
 'page', true, NOW(),
 'Om Os - Professionel Loctician i København',
 'Læs om vores passion for naturlig hårpleje og loc specialister med over 10 års erfaring i København.'),

('Booking Politik', 'booking-politik',
 '<h1>Booking Politik</h1>

  <h2>Booking og Aflysning</h2>
  <ul>
    <li>Bookings skal foretages minimum 24 timer i forvejen</li>
    <li>Aflysninger skal ske senest 24 timer før aftalen</li>
    <li>Ved aflysning mindre end 24 timer før, opkræves 50% af serviceprisen</li>
    <li>Ved udeblivelse opkræves fuld pris</li>
  </ul>

  <h2>Betaling</h2>
  <ul>
    <li>Betaling sker på dagen via MobilePay, kort eller kontant</li>
    <li>For større services (over 4 timer) kræves depositum på 50%</li>
    <li>Priser er inklusiv moms</li>
  </ul>

  <h2>Forberedelse til Aftale</h2>
  <ul>
    <li>Kom med rent hår (vasket inden for de sidste 2 dage)</li>
    <li>Undgå styling produkter dagen før</li>
    <li>Medbringe egen hovedbeklædning hvis ønsket</li>
  </ul>',
 'page', true, NOW(),
 'Booking Politik - Regler og Betingelser',
 'Læs vores booking politik, aflysningsregler og betalingsbetingelser før din aftale.');

-- =====================================================
-- SAMPLE INSTAGRAM POSTS
-- =====================================================

INSERT INTO instagram_posts (instagram_id, post_type, caption, media_url, permalink, likes_count, comments_count, posted_at, is_featured) VALUES
('17841234567890123', 'image',
 'Beautiful protective styling session today! ✨ Keeping those locs healthy and gorgeous. #locs #protectivestyling #naturalhair #copenhagen #loctician',
 'https://example.com/instagram/post1.jpg',
 'https://instagram.com/p/ABC123/',
 45, 8, NOW() - INTERVAL '2 days', true),

('17841234567890124', 'image',
 'Root maintenance is key to healthy loc growth 🌱 Regular appointments keep your locs looking fresh! #locmaintenance #healthyhair #rootcare',
 'https://example.com/instagram/post2.jpg',
 'https://instagram.com/p/DEF456/',
 32, 5, NOW() - INTERVAL '5 days', true),

('17841234567890125', 'carousel',
 'Before and after loc repair session 💫 Amazing transformation! Never underestimate the power of professional care. #locrepair #transformation #beforeandafter',
 'https://example.com/instagram/post3.jpg',
 'https://instagram.com/p/GHI789/',
 78, 12, NOW() - INTERVAL '1 week', true);

-- =====================================================
-- SAMPLE CALENDAR EVENTS
-- =====================================================

INSERT INTO calendar_events (loctician_id, title, description, event_type, time_range, is_public) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Frokostpause', 'Daglig frokostpause', 'break',
 tstzrange('2024-09-25 12:00:00+02', '2024-09-25 13:00:00+02'), false),

('550e8400-e29b-41d4-a716-446655440002', 'Uddannelseskursus', 'Avanceret loc teknik kursus', 'training',
 tstzrange('2024-09-30 09:00:00+02', '2024-09-30 17:00:00+02'), false),

('550e8400-e29b-41d4-a716-446655440001', 'Personalemøde', 'Månedligt team møde', 'meeting',
 tstzrange('2024-10-01 08:00:00+02', '2024-10-01 09:00:00+02'), false);

-- =====================================================
-- INITIALIZE ANALYTICS DATA
-- =====================================================

-- Sample daily metrics for the past month
INSERT INTO daily_metrics (date, loctician_id, total_bookings, confirmed_bookings, total_revenue, service_revenue)
SELECT
    date_series.date,
    locticians.id,
    FLOOR(RANDOM() * 5 + 1)::INTEGER as total_bookings,
    FLOOR(RANDOM() * 4 + 1)::INTEGER as confirmed_bookings,
    ROUND((RANDOM() * 2000 + 500)::NUMERIC, 2) as total_revenue,
    ROUND((RANDOM() * 1800 + 400)::NUMERIC, 2) as service_revenue
FROM generate_series(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE - INTERVAL '1 day',
    INTERVAL '1 day'
) AS date_series(date)
CROSS JOIN (
    SELECT id FROM users WHERE role = 'loctician' AND status = 'active'
) AS locticians
WHERE EXTRACT(DOW FROM date_series.date) BETWEEN 1 AND 6; -- Only weekdays

-- Initialize customer visit summaries
INSERT INTO customer_visit_summary (customer_id, first_visit_date, last_visit_date, total_visits, total_spent)
SELECT
    u.id,
    MIN(b.appointment_start::DATE),
    MAX(b.appointment_start::DATE),
    COUNT(b.id),
    SUM(b.total_amount)
FROM users u
JOIN bookings b ON u.id = b.customer_id
WHERE u.role = 'customer' AND b.status = 'completed'
GROUP BY u.id;

-- =====================================================
-- VERIFY DATA INTEGRITY
-- =====================================================

-- Check for any constraint violations
DO $$
DECLARE
    violation_count INTEGER;
BEGIN
    -- Check for overlapping bookings (should be 0)
    SELECT COUNT(*) INTO violation_count
    FROM bookings b1
    JOIN bookings b2 ON b1.loctician_id = b2.loctician_id
        AND b1.id != b2.id
        AND b1.status NOT IN ('cancelled')
        AND b2.status NOT IN ('cancelled')
        AND tstzrange(b1.appointment_start, b1.appointment_end) && tstzrange(b2.appointment_start, b2.appointment_end);

    IF violation_count > 0 THEN
        RAISE WARNING 'Found % overlapping bookings - this should not happen!', violation_count;
    ELSE
        RAISE NOTICE 'No overlapping bookings found - constraints working correctly!';
    END IF;

    -- Check GDPR compliance
    SELECT COUNT(*) INTO violation_count
    FROM users
    WHERE data_retention_until < NOW() AND deleted_at IS NULL;

    IF violation_count > 0 THEN
        RAISE WARNING 'Found % users past retention date that need cleanup', violation_count;
    ELSE
        RAISE NOTICE 'All users within GDPR retention limits';
    END IF;
END $$;