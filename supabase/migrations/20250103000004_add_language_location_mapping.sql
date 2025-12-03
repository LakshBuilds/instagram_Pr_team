-- Create language-location mapping table
CREATE TABLE IF NOT EXISTS public.language_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    language text NOT NULL,
    state text NOT NULL,
    cities text[], -- Array of cities
    description text,
    latitude numeric(10, 7),
    longitude numeric(10, 7),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Insert language-location mappings
INSERT INTO public.language_locations (language, state, cities, description, latitude, longitude) VALUES
('Hindi', 'Uttar Pradesh', ARRAY['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Allahabad'], 'India''s largest language population', 26.8467, 80.9462),
('Hindi', 'Bihar', ARRAY['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'], 'India''s largest language population', 25.5941, 85.1376),
('Hindi', 'Madhya Pradesh', ARRAY['Bhopal', 'Indore', 'Gwalior', 'Jabalpur'], 'India''s largest language population', 23.2599, 77.4126),
('Hindi', 'Rajasthan', ARRAY['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'], 'India''s largest language population', 26.9124, 75.7873),
('Hindi', 'Uttarakhand', ARRAY['Dehradun', 'Haridwar', 'Nainital'], 'India''s largest language population', 30.3165, 78.0322),
('Hindi', 'Haryana', ARRAY['Gurgaon', 'Faridabad', 'Panipat', 'Ambala'], 'India''s largest language population', 28.4089, 77.0378),
('Hindi', 'Himachal Pradesh', ARRAY['Shimla', 'Manali', 'Dharamshala'], 'India''s largest language population', 31.1048, 77.1734),
('Hindi', 'Delhi', ARRAY['New Delhi', 'Delhi'], 'India''s largest language population', 28.6139, 77.2090),
('Hindi', 'Chhattisgarh', ARRAY['Raipur', 'Bilaspur', 'Durg'], 'India''s largest language population', 21.2514, 81.6296),
('Hindi', 'Jharkhand', ARRAY['Ranchi', 'Jamshedpur', 'Dhanbad'], 'India''s largest language population', 23.3441, 85.3096),

('English', 'Delhi', ARRAY['New Delhi'], 'Business + education language', 28.6139, 77.2090),
('English', 'Maharashtra', ARRAY['Mumbai', 'Pune'], 'Business + education language', 19.0760, 72.8777),
('English', 'Karnataka', ARRAY['Bangalore'], 'Business + education language', 12.9716, 77.5946),
('English', 'Telangana', ARRAY['Hyderabad'], 'Business + education language', 17.3850, 78.4867),
('English', 'Tamil Nadu', ARRAY['Chennai'], 'Business + education language', 13.0827, 80.2707),
('English', 'West Bengal', ARRAY['Kolkata'], 'Business + education language', 22.5726, 88.3639),

('Bengali', 'West Bengal', ARRAY['Kolkata', 'Howrah', 'Durgapur', 'Asansol'], '2nd most spoken in India', 22.5726, 88.3639),
('Bengali', 'Tripura', ARRAY['Agartala'], '2nd most spoken in India', 23.8315, 91.2868),
('Bengali', 'Assam', ARRAY['Silchar', 'Karimganj'], '2nd most spoken in India', 24.8333, 92.7789),

('Marathi', 'Maharashtra', ARRAY['Mumbai', 'Pune', 'Nagpur', 'Aurangabad', 'Nashik'], 'Mumbai + Pune core language', 19.0760, 72.8777),
('Marathi', 'Goa', ARRAY['Panaji', 'Vasco da Gama'], 'Mumbai + Pune core language', 15.4909, 73.8278),

('Gujarati', 'Gujarat', ARRAY['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'], 'Business-heavy community', 23.0225, 72.5714),
('Gujarati', 'Dadra and Nagar Haveli', ARRAY['Silvassa'], 'Business-heavy community', 20.2734, 73.0169),
('Gujarati', 'Daman and Diu', ARRAY['Daman', 'Diu'], 'Business-heavy community', 20.4283, 72.8397),

('Tamil', 'Tamil Nadu', ARRAY['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'], 'Strong diaspora globally', 13.0827, 80.2707),
('Tamil', 'Puducherry', ARRAY['Pondicherry'], 'Strong diaspora globally', 11.9416, 79.8083),

('Telugu', 'Andhra Pradesh', ARRAY['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore'], 'Second-largest Dravidian language', 17.3850, 78.4867),
('Telugu', 'Telangana', ARRAY['Hyderabad', 'Warangal', 'Nizamabad'], 'Second-largest Dravidian language', 17.3850, 78.4867),

('Kannada', 'Karnataka', ARRAY['Bangalore', 'Mysuru', 'Hubli', 'Mangalore'], 'Bangalore + Mysuru region', 12.9716, 77.5946),

('Malayalam', 'Kerala', ARRAY['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'], 'Middle East diaspora bhi huge', 9.9312, 76.2673),
('Malayalam', 'Lakshadweep', ARRAY['Kavaratti'], 'Middle East diaspora bhi huge', 10.5667, 72.6417),

('Punjabi', 'Punjab', ARRAY['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar'], 'Music + culture global', 30.7333, 76.7794),
('Punjabi', 'Haryana', ARRAY['Chandigarh', 'Ambala'], 'Music + culture global', 30.7333, 76.7794),
('Punjabi', 'Delhi', ARRAY['New Delhi'], 'Music + culture global', 28.6139, 77.2090),

('Urdu', 'Jammu and Kashmir', ARRAY['Srinagar', 'Jammu'], 'Similar to Hindi scriptually different', 34.0837, 74.7973),
('Urdu', 'Telangana', ARRAY['Hyderabad'], 'Similar to Hindi scriptually different', 17.3850, 78.4867),
('Urdu', 'Uttar Pradesh', ARRAY['Lucknow', 'Aligarh'], 'Similar to Hindi scriptually different', 26.8467, 80.9462),
('Urdu', 'Bihar', ARRAY['Patna'], 'Similar to Hindi scriptually different', 25.5941, 85.1376),

('Odia', 'Odisha', ARRAY['Bhubaneswar', 'Cuttack', 'Rourkela'], 'Classical language', 20.2961, 85.8245),

('Assamese', 'Assam', ARRAY['Guwahati', 'Dibrugarh', 'Silchar'], 'North-East''s major language', 26.1445, 91.7362),

('Konkani', 'Goa', ARRAY['Panaji', 'Margao'], 'Tourism-heavy region', 15.4909, 73.8278),
('Konkani', 'Karnataka', ARRAY['Mangalore', 'Udupi'], 'Tourism-heavy region', 12.9141, 74.8560),
('Konkani', 'Maharashtra', ARRAY['Ratnagiri', 'Sindhudurg'], 'Tourism-heavy region', 16.9904, 73.3096),

('Maithili', 'Bihar', ARRAY['Darbhanga', 'Madhubani', 'Sitamarhi'], 'Classical language', 26.1522, 85.8970),
('Maithili', 'Jharkhand', ARRAY['Deoghar'], 'Classical language', 24.4819, 86.7030),

('Dogri', 'Jammu and Kashmir', ARRAY['Jammu'], 'Scheduled language', 32.7266, 74.8570),

('Kashmiri', 'Jammu and Kashmir', ARRAY['Srinagar', 'Anantnag'], 'Indo-Aryan unique dialect', 34.0837, 74.7973),

('Sindhi', 'Rajasthan', ARRAY['Jodhpur'], 'No state-level region', 26.2389, 73.0243),
('Sindhi', 'Gujarat', ARRAY['Ahmedabad'], 'No state-level region', 23.0225, 72.5714),
('Sindhi', 'Maharashtra', ARRAY['Mumbai', 'Pune'], 'No state-level region', 19.0760, 72.8777),

('Manipuri', 'Manipur', ARRAY['Imphal'], 'Tibeto-Burman language', 24.8170, 93.9368),

('Bodo', 'Assam', ARRAY['Kokrajhar', 'Bongaigaon'], 'North-East scheduled language', 26.4041, 90.2739),

('Santali', 'Jharkhand', ARRAY['Ranchi', 'Dumka'], 'Tribal language', 23.3441, 85.3096),
('Santali', 'West Bengal', ARRAY['Bankura', 'Purulia'], 'Tribal language', 23.2324, 87.0715),
('Santali', 'Odisha', ARRAY['Mayurbhanj'], 'Tribal language', 21.9459, 86.7265),

('Garo', 'Meghalaya', ARRAY['Tura', 'Williamnagar'], 'North-East', 25.5149, 90.2026),

('Khasi', 'Meghalaya', ARRAY['Shillong'], 'North-East', 25.5788, 91.8933),

('Mizo', 'Mizoram', ARRAY['Aizawl'], 'North-East', 23.7271, 92.7176),

('Tulu', 'Karnataka', ARRAY['Mangalore', 'Udupi'], 'Not yet scheduled language', 12.9141, 74.8560),
('Tulu', 'Kerala', ARRAY['Kasargod'], 'Not yet scheduled language', 12.4984, 75.0154),

('Marwari', 'Rajasthan', ARRAY['Jodhpur', 'Bikaner', 'Jaisalmer'], 'Rajasthani dialect cluster', 26.2389, 73.0243),

('Haryanvi', 'Haryana', ARRAY['Rohtak', 'Hisar', 'Karnal'], 'Hindi family', 28.8955, 76.6066),

('Bhojpuri', 'Uttar Pradesh', ARRAY['Varanasi', 'Gorakhpur', 'Allahabad'], 'Extremely widely spoken', 25.3176, 82.9739),
('Bhojpuri', 'Bihar', ARRAY['Patna', 'Gaya', 'Muzaffarpur'], 'Extremely widely spoken', 25.5941, 85.1376),

('Rajasthani', 'Rajasthan', ARRAY['Jaipur', 'Jodhpur', 'Udaipur', 'Bikaner'], 'Umbrella of dialects', 26.9124, 75.7873),

('Garhwali', 'Uttarakhand', ARRAY['Dehradun', 'Haridwar'], 'Regional languages', 30.3165, 78.0322),
('Kumaoni', 'Uttarakhand', ARRAY['Nainital', 'Almora'], 'Regional languages', 29.3913, 79.4542),

('Sikkimese', 'Sikkim', ARRAY['Gangtok'], 'East Himalayan', 27.3389, 88.6065);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_language_locations_language ON public.language_locations(language);
CREATE INDEX IF NOT EXISTS idx_language_locations_state ON public.language_locations(state);

-- Enable RLS
ALTER TABLE public.language_locations ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read language locations
CREATE POLICY "Anyone can view language locations"
    ON public.language_locations FOR SELECT
    TO authenticated
    USING (true);

-- Add comment
COMMENT ON TABLE public.language_locations IS 'Maps languages to Indian states and cities with coordinates for map visualization';

