-- Create language-location mapping table
CREATE TABLE IF NOT EXISTS public.language_location_mapping (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    language text NOT NULL,
    state text NOT NULL,
    cities text[], -- Array of cities
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Insert language-location mappings
INSERT INTO public.language_location_mapping (language, state, cities, description) VALUES
('Hindi', 'Uttar Pradesh', ARRAY['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Allahabad'], 'India''s largest language population'),
('Hindi', 'Bihar', ARRAY['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'], 'India''s largest language population'),
('Hindi', 'Madhya Pradesh', ARRAY['Bhopal', 'Indore', 'Gwalior', 'Jabalpur'], 'India''s largest language population'),
('Hindi', 'Rajasthan', ARRAY['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'], 'India''s largest language population'),
('Hindi', 'Uttarakhand', ARRAY['Dehradun', 'Haridwar', 'Nainital'], 'India''s largest language population'),
('Hindi', 'Haryana', ARRAY['Gurgaon', 'Faridabad', 'Panipat', 'Ambala'], 'India''s largest language population'),
('Hindi', 'Himachal Pradesh', ARRAY['Shimla', 'Manali', 'Dharamshala'], 'India''s largest language population'),
('Hindi', 'Delhi', ARRAY['New Delhi', 'Delhi'], 'India''s largest language population'),
('Hindi', 'Chhattisgarh', ARRAY['Raipur', 'Bilaspur', 'Durg'], 'India''s largest language population'),
('Hindi', 'Jharkhand', ARRAY['Ranchi', 'Jamshedpur', 'Dhanbad'], 'India''s largest language population'),

('English', 'Delhi', ARRAY['New Delhi', 'Delhi'], 'Business + education language'),
('English', 'Maharashtra', ARRAY['Mumbai', 'Pune'], 'Business + education language'),
('English', 'Karnataka', ARRAY['Bangalore', 'Mysuru'], 'Business + education language'),
('English', 'Telangana', ARRAY['Hyderabad'], 'Business + education language'),
('English', 'Tamil Nadu', ARRAY['Chennai'], 'Business + education language'),
('English', 'West Bengal', ARRAY['Kolkata'], 'Business + education language'),

('Bengali', 'West Bengal', ARRAY['Kolkata', 'Howrah', 'Durgapur', 'Asansol'], '2nd most spoken in India'),
('Bengali', 'Tripura', ARRAY['Agartala'], '2nd most spoken in India'),
('Bengali', 'Assam', ARRAY['Silchar'], '2nd most spoken in India'),

('Marathi', 'Maharashtra', ARRAY['Mumbai', 'Pune', 'Nagpur', 'Aurangabad', 'Nashik'], 'Mumbai + Pune core language'),
('Marathi', 'Goa', ARRAY['Panaji', 'Vasco da Gama'], 'Mumbai + Pune core language'),

('Gujarati', 'Gujarat', ARRAY['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'], 'Business-heavy community'),
('Gujarati', 'Dadra and Nagar Haveli', ARRAY['Silvassa'], 'Business-heavy community'),
('Gujarati', 'Daman and Diu', ARRAY['Daman', 'Diu'], 'Business-heavy community'),

('Tamil', 'Tamil Nadu', ARRAY['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'], 'Strong diaspora globally'),
('Tamil', 'Puducherry', ARRAY['Puducherry'], 'Strong diaspora globally'),

('Telugu', 'Andhra Pradesh', ARRAY['Visakhapatnam', 'Vijayawada', 'Guntur'], 'Second-largest Dravidian language'),
('Telugu', 'Telangana', ARRAY['Hyderabad', 'Warangal', 'Nizamabad'], 'Second-largest Dravidian language'),

('Kannada', 'Karnataka', ARRAY['Bangalore', 'Mysuru', 'Mangalore', 'Hubli'], 'Bangalore + Mysuru region'),

('Malayalam', 'Kerala', ARRAY['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'], 'Middle East diaspora bhi huge'),
('Malayalam', 'Lakshadweep', ARRAY['Kavaratti'], 'Middle East diaspora bhi huge'),

('Punjabi', 'Punjab', ARRAY['Amritsar', 'Ludhiana', 'Chandigarh', 'Jalandhar'], 'Music + culture global'),
('Punjabi', 'Chandigarh', ARRAY['Chandigarh'], 'Music + culture global'),
('Punjabi', 'Haryana', ARRAY['Gurgaon', 'Faridabad'], 'Music + culture global'),
('Punjabi', 'Delhi', ARRAY['New Delhi', 'Delhi'], 'Music + culture global'),

('Urdu', 'Jammu and Kashmir', ARRAY['Srinagar', 'Jammu'], 'Similar to Hindi scriptually different'),
('Urdu', 'Telangana', ARRAY['Hyderabad'], 'Similar to Hindi scriptually different'),
('Urdu', 'Uttar Pradesh', ARRAY['Lucknow', 'Kanpur'], 'Similar to Hindi scriptually different'),
('Urdu', 'Bihar', ARRAY['Patna'], 'Similar to Hindi scriptually different'),

('Odia', 'Odisha', ARRAY['Bhubaneswar', 'Cuttack', 'Rourkela'], 'Classical language'),

('Assamese', 'Assam', ARRAY['Guwahati', 'Dibrugarh', 'Silchar'], 'North-East''s major language'),

('Konkani', 'Goa', ARRAY['Panaji', 'Margao'], 'Tourism-heavy region'),
('Konkani', 'Karnataka', ARRAY['Mangalore', 'Udupi'], 'Tourism-heavy region'),
('Konkani', 'Maharashtra', ARRAY['Mumbai'], 'Tourism-heavy region'),

('Maithili', 'Bihar', ARRAY['Darbhanga', 'Muzaffarpur'], 'Classical language'),
('Maithili', 'Jharkhand', ARRAY['Ranchi'], 'Classical language'),

('Dogri', 'Jammu and Kashmir', ARRAY['Jammu'], 'Scheduled language'),

('Kashmiri', 'Jammu and Kashmir', ARRAY['Srinagar'], 'Indo-Aryan unique dialect'),

('Sindhi', 'Rajasthan', ARRAY['Jodhpur'], 'No state-level region'),
('Sindhi', 'Gujarat', ARRAY['Ahmedabad'], 'No state-level region'),
('Sindhi', 'Maharashtra', ARRAY['Mumbai'], 'No state-level region'),

('Manipuri (Meiteilon)', 'Manipur', ARRAY['Imphal'], 'Tibeto-Burman language'),

('Hinglish', 'Delhi', ARRAY['New Delhi', 'Delhi'], 'Mix of Hindi and English'),
('Hinglish', 'Maharashtra', ARRAY['Mumbai', 'Pune'], 'Mix of Hindi and English'),
('Hinglish', 'Karnataka', ARRAY['Bangalore'], 'Mix of Hindi and English'),
('Hinglish', 'Telangana', ARRAY['Hyderabad'], 'Mix of Hindi and English');

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_language_location_mapping_language ON public.language_location_mapping(language);
CREATE INDEX IF NOT EXISTS idx_language_location_mapping_state ON public.language_location_mapping(state);

-- Add comment
COMMENT ON TABLE public.language_location_mapping IS 'Maps languages to states and cities in India';

