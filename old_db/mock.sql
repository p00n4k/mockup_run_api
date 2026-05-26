-- ============================================================
-- IDENTITY
-- ============================================================

INSERT INTO identity.users (id, email, name, created_at) VALUES
(1, 'pawin@example.com',  'Pawin Khamlaksana', now()),
(2, 'mali@example.com',   'Mali Srisuk',       now()),
(3, 'niran@example.com',  'Niran Wongchai',    now());

INSERT INTO identity.user_profiles (
  user_id, birthday, gender,
  height_cm, weight_kg, step_length_cm, stride_length_cm, preferred_units
) VALUES
(1, '2004-08-15', 'male',   175.00, 68.50, 72.00, 144.00, 'metric'),
(2, '2001-03-22', 'female', 162.00, 54.20, 65.00, 130.00, 'metric'),
(3, '1998-11-09', 'male',   180.00, 76.80, 75.00, 150.00, 'metric');

INSERT INTO identity.user_health_stats_smart_watch (
  user_id,
  resting_heart_rate_bpm, max_heart_rate_bpm, min_heart_rate_bpm, avg_heart_rate_bpm,
  vo2max, min_vo2max, max_vo2max, avg_vo2max,
  blood_oxygen_pct, min_blood_oxygen_pct, max_blood_oxygen_pct, avg_blood_oxygen_pct,
  respiratory_rate_bpm, min_respiratory_rate_bpm, max_respiratory_rate_bpm, avg_respiratory_rate_bpm,
  basal_metabolic_rate_kcal,
  active_energy_kcal_avg, min_active_energy_kcal, max_active_energy_kcal,
  sleep_duration_min_avg, min_sleep_duration_min, max_sleep_duration_min,
  sleep_score_avg, min_sleep_score, max_sleep_score,
  stats_period_start, stats_period_end
) VALUES
(1, 58, 190, 48, 132,  48.50, 44.20, 52.10, 48.30,  98.00, 95.00, 100.00, 97.80,  15.20, 12.50, 20.00, 15.80,  1650,  520, 250,  870,  430, 360, 510,  82.50, 70.00, 94.00,  now()-interval '30 days', now()),
(2, 62, 185, 52, 128,  42.70, 39.50, 46.30, 42.20,  97.50, 94.00, 100.00, 97.10,  16.00, 13.20, 21.00, 16.40,  1380,  460, 210,  760,  455, 380, 540,  85.20, 74.00, 96.00,  now()-interval '30 days', now()),
(3, 55, 195, 45, 138,  51.20, 47.00, 55.60, 51.00,  98.20, 96.00, 100.00, 98.00,  14.80, 12.00, 19.50, 15.10,  1780,  610, 300,  980,  410, 330, 500,  79.80, 65.00, 91.00,  now()-interval '30 days', now());

-- ============================================================
-- RUNNING — run_sessions
-- session 1-6 = Pawin (user 1)
-- session 7-8 = Mali  (user 2)
-- session 9-10= Niran (user 3)
-- สถานที่: แถวสวนลุมพินี / จตุจักร กรุงเทพฯ
-- WKT geometry: LINESTRING(longitude latitude, ...) — PostGIS order
-- ============================================================

INSERT INTO running.run_sessions (
  id,
  user_id, started_at, ended_at,
  distance_km, duration_sec,
  avg_pace_sec, min_pace_sec, max_pace_sec,
  start_lat, start_lng, end_lat, end_lng,
  route_polyline,
  route_geom
) OVERRIDING SYSTEM VALUE VALUES

-- s1: Pawin — ลุมพินี 5.2km
( 1, 1, now()-interval '1 day'  +time '06:00', now()-interval '1 day'  +time '06:00'+interval '2100 sec',
  5.20, 2100, 403, 358, 450,
  13.7283, 100.5418, 13.7310, 100.5460,
  '{hxrAgatdR{OgYgc@fEoFnd@nd@vQbVgc@',
  ST_GeomFromText('LINESTRING(100.5418 13.7283, 100.5430 13.7293, 100.5445 13.7302, 100.5455 13.7308, 100.5460 13.7310)', 4326)),

-- s2: Pawin — จตุจักร 8.1km
( 2, 1, now()-interval '3 days' +time '06:15', now()-interval '3 days' +time '06:15'+interval '3120 sec',
  8.10, 3120, 385, 340, 430,
  13.7480, 100.4950, 13.7550, 100.5020,
  '_d|rAw|jdRwj@wj@g^fEnK~p@~p@nKnK_X',
  ST_GeomFromText('LINESTRING(100.4950 13.7480, 100.4965 13.7495, 100.4980 13.7510, 100.5000 13.7527, 100.5015 13.7540, 100.5020 13.7550)', 4326)),

-- s3: Pawin — รัชดา 4.5km
( 3, 1, now()-interval '5 days' +time '06:30', now()-interval '5 days' +time '06:30'+interval '1680 sec',
  4.50, 1680, 373, 330, 420,
  13.7520, 100.5000, 13.7560, 100.5030,
  '_}|rA_|kdR_X_XoKnKnKvQ?_X',
  ST_GeomFromText('LINESTRING(100.5000 13.7520, 100.5010 13.7533, 100.5020 13.7545, 100.5030 13.7560)', 4326)),

-- s4: Pawin — ลุมพินี 7.0km
( 4, 1, now()-interval '14 days'+time '06:00', now()-interval '14 days'+time '06:00'+interval '2745 sec',
  7.00, 2745, 392, 350, 440,
  13.7283, 100.5418, 13.7350, 100.5480,
  '{hxrAgatdR{h@_l@g^nKnKfw@~p@nKg^_jA',
  ST_GeomFromText('LINESTRING(100.5418 13.7283, 100.5435 13.7300, 100.5450 13.7318, 100.5462 13.7332, 100.5470 13.7342, 100.5480 13.7350)', 4326)),

-- s5: Pawin — ลุมพินี 10.0km (long run)
( 5, 1, now()-interval '20 days'+time '07:00', now()-interval '20 days'+time '07:00'+interval '3980 sec',
  10.00, 3980, 398, 355, 450,
  13.7283, 100.5418, 13.7400, 100.5500,
  '{hxrAgatdR{h@_l@wj@oKwQnd@vQvj@~p@vQod@w|A',
  ST_GeomFromText('LINESTRING(100.5418 13.7283, 100.5432 13.7305, 100.5448 13.7328, 100.5462 13.7350, 100.5474 13.7370, 100.5488 13.7388, 100.5500 13.7400)', 4326)),

-- s6: Pawin — รัชดา 3.2km (easy run)
( 6, 1, now()-interval '25 days'+time '06:45', now()-interval '25 days'+time '06:45'+interval '1328 sec',
  3.20, 1328, 415, 370, 465,
  13.7520, 100.5000, 13.7540, 100.5020,
  '_}|rA_|kdRoKwQgEnKfEgE',
  ST_GeomFromText('LINESTRING(100.5000 13.7520, 100.5008 13.7528, 100.5015 13.7534, 100.5020 13.7540)', 4326)),

-- s7: Mali — ลุมพินี 4.0km
( 7, 2, now()-interval '2 days' +time '06:30', now()-interval '2 days' +time '06:30'+interval '1712 sec',
  4.00, 1712, 428, 390, 480,
  13.7283, 100.5418, 13.7310, 100.5450,
  '{hxrAgatdR{O_SoKfEnKvQ?_X',
  ST_GeomFromText('LINESTRING(100.5418 13.7283, 100.5428 13.7293, 100.5438 13.7302, 100.5450 13.7310)', 4326)),

-- s8: Mali — จตุจักร 6.5km
( 8, 2, now()-interval '7 days' +time '06:00', now()-interval '7 days' +time '06:00'+interval '2873 sec',
  6.50, 2873, 442, 400, 495,
  13.7480, 100.4950, 13.7530, 100.5010,
  '_d|rAw|jdRg^od@wQfEnKf^fEod@',
  ST_GeomFromText('LINESTRING(100.4950 13.7480, 100.4966 13.7495, 100.4982 13.7508, 100.4997 13.7520, 100.5010 13.7530)', 4326)),

-- s9: Niran — ลุมพินี 12.0km (long run)
( 9, 3, now()-interval '1 day'  +time '05:45', now()-interval '1 day'  +time '05:45'+interval '4296 sec',
  12.00, 4296, 358, 315, 405,
  13.7283, 100.5418, 13.7450, 100.5520,
  '{hxrAgatdR{h@_l@wj@wQ_q@nKoKnd@~Wnd@n}@nKwj@_cB',
  ST_GeomFromText('LINESTRING(100.5418 13.7283, 100.5435 13.7308, 100.5455 13.7332, 100.5472 13.7358, 100.5488 13.7382, 100.5505 13.7408, 100.5515 13.7432, 100.5520 13.7450)', 4326)),

-- s10: Niran — รัชดา 5.5km
(10, 3, now()-interval '4 days' +time '06:00', now()-interval '4 days' +time '06:00'+interval '1936 sec',
  5.50, 1936, 352, 310, 398,
  13.7520, 100.5000, 13.7560, 100.5040,
  '_}|rA_|kdRg^_XwQnKnKvQnKg^',
  ST_GeomFromText('LINESTRING(100.5000 13.7520, 100.5012 13.7532, 100.5022 13.7544, 100.5032 13.7554, 100.5040 13.7560)', 4326));

-- sync sequence ให้ต่อจาก ID 10
SELECT setval(pg_get_serial_sequence('running.run_sessions', 'id'), 10);

-- ============================================================
-- RUNNING — run_environment_summary
-- ============================================================

INSERT INTO running.run_environment_summary (
  session_id,
  avg_temperature, min_temperature, max_temperature,
  avg_feels_like,  min_feels_like,  max_feels_like,
  avg_heat_index,  min_heat_index,  max_heat_index,
  avg_humidity,    min_humidity,    max_humidity,
  avg_pm25,        min_pm25,        max_pm25,
  avg_pm10,        min_pm10,        max_pm10,
  avg_co,          min_co,          max_co,
  avg_aqi,         min_aqi,         max_aqi,
  avg_uv_index,    min_uv_index,    max_uv_index,
  avg_wind_speed,  min_wind_speed,  max_wind_speed,
  avg_cloud_cover_pct, min_cloud_cover_pct, max_cloud_cover_pct
) VALUES
( 1,  31.2, 29.8, 32.5,  37.5, 35.8, 39.2,  37.5, 35.8, 39.2,  74.0, 68.0, 80.0,  24.5, 18.0, 30.2,  38.0, 28.0, 46.0,  0.420, 0.300, 0.550,   75, 65,  88,  6.80, 4.20,  9.10,  12.0,  8.0, 18.0,  35.0, 20.0, 50.0),
( 2,  30.5, 29.0, 32.0,  36.2, 34.5, 38.0,  36.2, 34.5, 38.0,  71.0, 65.0, 77.0,  20.8, 15.0, 26.5,  33.0, 24.0, 40.0,  0.380, 0.250, 0.500,   68, 55,  80,  5.50, 3.00,  8.20,  14.0,  9.0, 20.0,  28.0, 15.0, 42.0),
( 3,  28.8, 27.5, 30.2,  33.0, 31.5, 34.8,  33.0, 31.5, 34.8,  65.0, 60.0, 70.0,  12.2,  8.5, 16.0,  20.0, 14.0, 26.0,  0.280, 0.180, 0.380,   48, 38,  58,  4.20, 2.50,  6.50,  16.0, 11.0, 22.0,  45.0, 30.0, 58.0),
( 4,  33.0, 31.5, 34.8,  39.8, 38.0, 41.5,  39.8, 38.0, 41.5,  78.0, 72.0, 84.0,  32.5, 24.0, 40.0,  50.0, 38.0, 62.0,  0.520, 0.380, 0.680,   95, 80, 110,  7.50, 5.00, 10.00,  10.0,  6.0, 15.0,  25.0, 12.0, 38.0),
( 5,  34.2, 32.8, 35.5,  41.0, 39.5, 42.8,  41.0, 39.5, 42.8,  80.0, 75.0, 86.0,  38.0, 28.0, 48.0,  58.0, 44.0, 72.0,  0.600, 0.450, 0.750,  108, 92, 125,  8.20, 6.00, 11.00,   8.0,  4.0, 13.0,  20.0,  8.0, 32.0),
( 6,  29.5, 28.2, 31.0,  34.5, 33.0, 36.2,  34.5, 33.0, 36.2,  67.0, 62.0, 72.0,  15.8, 11.0, 20.5,  25.0, 18.0, 32.0,  0.320, 0.220, 0.420,   58, 48,  68,  5.00, 3.00,  7.50,  15.0, 10.0, 21.0,  40.0, 25.0, 55.0),
( 7,  30.8, 29.5, 32.2,  36.8, 35.2, 38.5,  36.8, 35.2, 38.5,  73.0, 67.0, 79.0,  22.0, 16.5, 28.0,  35.0, 26.0, 44.0,  0.400, 0.280, 0.520,   72, 62,  85,  6.20, 4.00,  8.80,  13.0,  8.0, 19.0,  32.0, 18.0, 46.0),
( 8,  29.2, 28.0, 30.5,  34.0, 32.5, 35.8,  34.0, 32.5, 35.8,  66.0, 61.0, 72.0,  14.5,  9.5, 19.0,  22.0, 15.0, 29.0,  0.300, 0.200, 0.400,   52, 42,  62,  4.50, 2.80,  7.00,  17.0, 12.0, 23.0,  48.0, 32.0, 62.0),
( 9,  32.5, 31.0, 34.0,  38.5, 37.0, 40.2,  38.5, 37.0, 40.2,  76.0, 70.0, 82.0,  28.0, 20.0, 36.0,  44.0, 32.0, 56.0,  0.480, 0.350, 0.620,   85, 72, 100,  7.00, 4.80,  9.50,  11.0,  7.0, 16.0,  30.0, 16.0, 44.0),
(10,  28.5, 27.2, 29.8,  32.8, 31.2, 34.5,  32.8, 31.2, 34.5,  63.0, 58.0, 68.0,  10.5,  7.0, 14.0,  17.0, 11.0, 23.0,  0.250, 0.150, 0.350,   44, 35,  54,  3.80, 2.00,  6.00,  18.0, 13.0, 24.0,  52.0, 38.0, 65.0);

-- ============================================================
-- RUNNING — run_scores
-- grade: excellent(90+), good(75-89), moderate(60-74), poor(40-59)
-- ============================================================

INSERT INTO running.run_scores (
  session_id,
  overall_score,
  heat_score, air_quality_score, uv_score,
  wind_score, humidity_score, cloud_score,
  grade, calories_burned_kcal, calculated_at
) VALUES
( 1,  78.50,  72.0, 80.0, 75.0,  85.0, 78.0, 82.0,  'good',       371, now()),
( 2,  82.30,  78.0, 85.0, 80.0,  88.0, 82.0, 86.0,  'good',       576, now()),
( 3,  91.00,  92.0, 95.0, 90.0,  92.0, 90.0, 88.0,  'excellent',  322, now()),
( 4,  68.50,  62.0, 70.0, 65.0,  78.0, 65.0, 72.0,  'moderate',   499, now()),
( 5,  63.20,  55.0, 65.0, 60.0,  72.0, 60.0, 68.0,  'moderate',   714, now()),
( 6,  80.10,  76.0, 82.0, 78.0,  86.0, 80.0, 84.0,  'good',       228, now()),
( 7,  77.80,  74.0, 80.0, 76.0,  84.0, 76.0, 80.0,  'good',       218, now()),
( 8,  85.40,  82.0, 88.0, 84.0,  90.0, 85.0, 88.0,  'good',       354, now()),
( 9,  71.20,  65.0, 74.0, 68.0,  80.0, 70.0, 74.0,  'moderate',   854, now()),
(10,  88.00,  86.0, 92.0, 88.0,  90.0, 88.0, 90.0,  'good',       397, now());

-- ============================================================
-- IDENTITY — run_smart_watch_summary
-- ============================================================

INSERT INTO identity.run_smart_watch_summary (
  session_id,
  avg_heart_rate_bpm, min_heart_rate_bpm, max_heart_rate_bpm,
  avg_blood_oxygen_pct, min_blood_oxygen_pct, max_blood_oxygen_pct,
  avg_respiratory_rate_bpm, min_respiratory_rate_bpm, max_respiratory_rate_bpm,
  avg_hrv_ms, min_hrv_ms, max_hrv_ms,
  avg_cadence_spm, min_cadence_spm, max_cadence_spm,
  calories_burned_kcal, active_energy_kcal,
  training_load, recovery_time_hr
) VALUES
( 1,  158, 132, 178,  97.20, 95.00, 99.00,  28.5, 22.0, 38.0,  28.50, 18.00, 52.00,  168, 155, 182,  371,  340,  42.50, 18),
( 2,  162, 138, 181,  97.00, 94.50, 98.80,  30.2, 24.0, 40.0,  25.80, 16.00, 48.00,  172, 160, 186,  576,  528,  68.20, 28),
( 3,  154, 128, 172,  97.50, 95.50, 99.20,  27.0, 21.0, 36.0,  30.20, 20.00, 55.00,  165, 152, 178,  322,  295,  35.80, 14),
( 4,  165, 142, 184,  96.80, 94.00, 98.50,  31.5, 25.0, 42.0,  24.50, 15.00, 45.00,  170, 158, 184,  499,  458,  58.90, 24),
( 5,  168, 145, 188,  96.50, 93.50, 98.20,  33.0, 26.0, 44.0,  22.80, 14.00, 42.00,  174, 162, 188,  714,  655,  88.50, 36),
( 6,  150, 125, 168,  97.80, 96.00, 99.50,  25.5, 20.0, 34.0,  32.50, 22.00, 58.00,  162, 150, 175,  228,  210,  25.20, 10),
( 7,  162, 135, 180,  97.00, 94.50, 99.00,  29.0, 22.5, 38.5,  27.20, 17.00, 50.00,  160, 148, 174,  218,  200,  38.50, 16),
( 8,  166, 140, 183,  96.80, 94.00, 98.80,  31.0, 24.5, 41.0,  24.80, 15.50, 46.00,  163, 150, 177,  354,  325,  58.20, 24),
( 9,  160, 138, 179,  97.30, 95.00, 99.10,  29.5, 23.0, 39.0,  26.50, 17.00, 48.00,  176, 165, 190,  854,  782, 105.80, 44),
(10,  155, 132, 174,  97.60, 95.50, 99.30,  27.5, 21.5, 37.0,  29.80, 19.00, 54.00,  174, 163, 188,  397,  364,  48.60, 20);

-- ============================================================
-- RUNNING — run_location_point  (GPS + env API, 4 pts/session)
-- IDs 1-4 = session 1, 5-8 = session 2, ... 37-40 = session 10
-- ============================================================

INSERT INTO running.run_location_point (
  id, session_id, recorded_at, elapsed_sec,
  lat, lng, geom,
  distance_km, current_pace_sec, elevation_m,
  temperature, humidity, feels_like, aqi,
  pm25, pm10, co, uv_index, wind_speed
) OVERRIDING SYSTEM VALUE VALUES

-- session 1
( 1, 1, (now()-interval '1 day' +time '06:00')+interval '0 sec',    0,   13.7283, 100.5418, ST_SetSRID(ST_MakePoint(100.5418, 13.7283), 4326),   0.00,   0, 1.5,  31.2, 74.0, 37.5,  75,  24.5, 38.0, 0.420, 6.80, 12.0),
( 2, 1, (now()-interval '1 day' +time '06:00')+interval '700 sec',  700, 13.7292, 100.5432, ST_SetSRID(ST_MakePoint(100.5432, 13.7292), 4326),   1.73, 405, 1.5,  31.2, 74.0, 37.5,  75,  24.5, 38.0, 0.420, 6.80, 12.0),
( 3, 1, (now()-interval '1 day' +time '06:00')+interval '1400 sec', 1400, 13.7301, 100.5446, ST_SetSRID(ST_MakePoint(100.5446, 13.7301), 4326),  3.47, 403, 1.5,  31.2, 74.0, 37.5,  75,  24.5, 38.0, 0.420, 6.80, 12.0),
( 4, 1, (now()-interval '1 day' +time '06:00')+interval '2100 sec', 2100, 13.7310, 100.5460, ST_SetSRID(ST_MakePoint(100.5460, 13.7310), 4326),  5.20, 450, 1.5,  31.2, 74.0, 37.5,  75,  24.5, 38.0, 0.420, 6.80, 12.0),

-- session 2
( 5, 2, (now()-interval '3 days'+time '06:15')+interval '0 sec',    0,   13.7480, 100.4950, ST_SetSRID(ST_MakePoint(100.4950, 13.7480), 4326),   0.00,   0, 1.8,  30.5, 71.0, 36.2,  68,  20.8, 33.0, 0.380, 5.50, 14.0),
( 6, 2, (now()-interval '3 days'+time '06:15')+interval '1040 sec', 1040, 13.7503, 100.4973, ST_SetSRID(ST_MakePoint(100.4973, 13.7503), 4326),  2.70, 385, 1.8,  30.5, 71.0, 36.2,  68,  20.8, 33.0, 0.380, 5.50, 14.0),
( 7, 2, (now()-interval '3 days'+time '06:15')+interval '2080 sec', 2080, 13.7527, 100.4997, ST_SetSRID(ST_MakePoint(100.4997, 13.7527), 4326),  5.40, 385, 1.8,  30.5, 71.0, 36.2,  68,  20.8, 33.0, 0.380, 5.50, 14.0),
( 8, 2, (now()-interval '3 days'+time '06:15')+interval '3120 sec', 3120, 13.7550, 100.5020, ST_SetSRID(ST_MakePoint(100.5020, 13.7550), 4326),  8.10, 430, 1.8,  30.5, 71.0, 36.2,  68,  20.8, 33.0, 0.380, 5.50, 14.0),

-- session 3
( 9, 3, (now()-interval '5 days'+time '06:30')+interval '0 sec',    0,   13.7520, 100.5000, ST_SetSRID(ST_MakePoint(100.5000, 13.7520), 4326),   0.00,   0, 2.1,  28.8, 65.0, 33.0,  48,  12.2, 20.0, 0.280, 4.20, 16.0),
(10, 3, (now()-interval '5 days'+time '06:30')+interval '560 sec',  560, 13.7533, 100.5010, ST_SetSRID(ST_MakePoint(100.5010, 13.7533), 4326),   1.50, 373, 2.1,  28.8, 65.0, 33.0,  48,  12.2, 20.0, 0.280, 4.20, 16.0),
(11, 3, (now()-interval '5 days'+time '06:30')+interval '1120 sec', 1120, 13.7547, 100.5020, ST_SetSRID(ST_MakePoint(100.5020, 13.7547), 4326),  3.00, 373, 2.1,  28.8, 65.0, 33.0,  48,  12.2, 20.0, 0.280, 4.20, 16.0),
(12, 3, (now()-interval '5 days'+time '06:30')+interval '1680 sec', 1680, 13.7560, 100.5030, ST_SetSRID(ST_MakePoint(100.5030, 13.7560), 4326),  4.50, 420, 2.1,  28.8, 65.0, 33.0,  48,  12.2, 20.0, 0.280, 4.20, 16.0),

-- session 4
(13, 4, (now()-interval '14 days'+time '06:00')+interval '0 sec',    0,   13.7283, 100.5418, ST_SetSRID(ST_MakePoint(100.5418, 13.7283), 4326),  0.00,   0, 1.5,  33.0, 78.0, 39.8,  95,  32.5, 50.0, 0.520, 7.50, 10.0),
(14, 4, (now()-interval '14 days'+time '06:00')+interval '915 sec',  915, 13.7305, 100.5439, ST_SetSRID(ST_MakePoint(100.5439, 13.7305), 4326),  2.33, 392, 1.5,  33.0, 78.0, 39.8,  95,  32.5, 50.0, 0.520, 7.50, 10.0),
(15, 4, (now()-interval '14 days'+time '06:00')+interval '1830 sec', 1830, 13.7327, 100.5459, ST_SetSRID(ST_MakePoint(100.5459, 13.7327), 4326), 4.67, 392, 1.5,  33.0, 78.0, 39.8,  95,  32.5, 50.0, 0.520, 7.50, 10.0),
(16, 4, (now()-interval '14 days'+time '06:00')+interval '2745 sec', 2745, 13.7350, 100.5480, ST_SetSRID(ST_MakePoint(100.5480, 13.7350), 4326), 7.00, 440, 1.5,  33.0, 78.0, 39.8,  95,  32.5, 50.0, 0.520, 7.50, 10.0),

-- session 5
(17, 5, (now()-interval '20 days'+time '07:00')+interval '0 sec',    0,   13.7283, 100.5418, ST_SetSRID(ST_MakePoint(100.5418, 13.7283), 4326),  0.00,   0, 1.5,  34.2, 80.0, 41.0, 108,  38.0, 58.0, 0.600, 8.20,  8.0),
(18, 5, (now()-interval '20 days'+time '07:00')+interval '1327 sec', 1327, 13.7322, 100.5445, ST_SetSRID(ST_MakePoint(100.5445, 13.7322), 4326), 3.33, 398, 1.5,  34.2, 80.0, 41.0, 108,  38.0, 58.0, 0.600, 8.20,  8.0),
(19, 5, (now()-interval '20 days'+time '07:00')+interval '2653 sec', 2653, 13.7361, 100.5473, ST_SetSRID(ST_MakePoint(100.5473, 13.7361), 4326), 6.67, 398, 1.5,  34.2, 80.0, 41.0, 108,  38.0, 58.0, 0.600, 8.20,  8.0),
(20, 5, (now()-interval '20 days'+time '07:00')+interval '3980 sec', 3980, 13.7400, 100.5500, ST_SetSRID(ST_MakePoint(100.5500, 13.7400), 4326), 10.00, 450, 1.5, 34.2, 80.0, 41.0, 108,  38.0, 58.0, 0.600, 8.20,  8.0),

-- session 6
(21, 6, (now()-interval '25 days'+time '06:45')+interval '0 sec',    0,   13.7520, 100.5000, ST_SetSRID(ST_MakePoint(100.5000, 13.7520), 4326),  0.00,   0, 2.1,  29.5, 67.0, 34.5,  58,  15.8, 25.0, 0.320, 5.00, 15.0),
(22, 6, (now()-interval '25 days'+time '06:45')+interval '443 sec',  443, 13.7527, 100.5007, ST_SetSRID(ST_MakePoint(100.5007, 13.7527), 4326),  1.07, 415, 2.1,  29.5, 67.0, 34.5,  58,  15.8, 25.0, 0.320, 5.00, 15.0),
(23, 6, (now()-interval '25 days'+time '06:45')+interval '885 sec',  885, 13.7533, 100.5013, ST_SetSRID(ST_MakePoint(100.5013, 13.7533), 4326),  2.13, 415, 2.1,  29.5, 67.0, 34.5,  58,  15.8, 25.0, 0.320, 5.00, 15.0),
(24, 6, (now()-interval '25 days'+time '06:45')+interval '1328 sec', 1328, 13.7540, 100.5020, ST_SetSRID(ST_MakePoint(100.5020, 13.7540), 4326), 3.20, 465, 2.1,  29.5, 67.0, 34.5,  58,  15.8, 25.0, 0.320, 5.00, 15.0),

-- session 7
(25, 7, (now()-interval '2 days' +time '06:30')+interval '0 sec',    0,   13.7283, 100.5418, ST_SetSRID(ST_MakePoint(100.5418, 13.7283), 4326),  0.00,   0, 1.5,  30.8, 73.0, 36.8,  72,  22.0, 35.0, 0.400, 6.20, 13.0),
(26, 7, (now()-interval '2 days' +time '06:30')+interval '571 sec',  571, 13.7292, 100.5429, ST_SetSRID(ST_MakePoint(100.5429, 13.7292), 4326),  1.33, 428, 1.5,  30.8, 73.0, 36.8,  72,  22.0, 35.0, 0.400, 6.20, 13.0),
(27, 7, (now()-interval '2 days' +time '06:30')+interval '1141 sec', 1141, 13.7301, 100.5439, ST_SetSRID(ST_MakePoint(100.5439, 13.7301), 4326), 2.67, 428, 1.5,  30.8, 73.0, 36.8,  72,  22.0, 35.0, 0.400, 6.20, 13.0),
(28, 7, (now()-interval '2 days' +time '06:30')+interval '1712 sec', 1712, 13.7310, 100.5450, ST_SetSRID(ST_MakePoint(100.5450, 13.7310), 4326), 4.00, 480, 1.5,  30.8, 73.0, 36.8,  72,  22.0, 35.0, 0.400, 6.20, 13.0),

-- session 8
(29, 8, (now()-interval '7 days' +time '06:00')+interval '0 sec',    0,   13.7480, 100.4950, ST_SetSRID(ST_MakePoint(100.4950, 13.7480), 4326),  0.00,   0, 1.8,  29.2, 66.0, 34.0,  52,  14.5, 22.0, 0.300, 4.50, 17.0),
(30, 8, (now()-interval '7 days' +time '06:00')+interval '958 sec',  958, 13.7497, 100.4970, ST_SetSRID(ST_MakePoint(100.4970, 13.7497), 4326),  2.17, 442, 1.8,  29.2, 66.0, 34.0,  52,  14.5, 22.0, 0.300, 4.50, 17.0),
(31, 8, (now()-interval '7 days' +time '06:00')+interval '1915 sec', 1915, 13.7513, 100.4990, ST_SetSRID(ST_MakePoint(100.4990, 13.7513), 4326), 4.33, 442, 1.8,  29.2, 66.0, 34.0,  52,  14.5, 22.0, 0.300, 4.50, 17.0),
(32, 8, (now()-interval '7 days' +time '06:00')+interval '2873 sec', 2873, 13.7530, 100.5010, ST_SetSRID(ST_MakePoint(100.5010, 13.7530), 4326), 6.50, 495, 1.8,  29.2, 66.0, 34.0,  52,  14.5, 22.0, 0.300, 4.50, 17.0),

-- session 9
(33, 9, (now()-interval '1 day'  +time '05:45')+interval '0 sec',    0,   13.7283, 100.5418, ST_SetSRID(ST_MakePoint(100.5418, 13.7283), 4326),  0.00,   0, 1.5,  32.5, 76.0, 38.5,  85,  28.0, 44.0, 0.480, 7.00, 11.0),
(34, 9, (now()-interval '1 day'  +time '05:45')+interval '1432 sec', 1432, 13.7339, 100.5452, ST_SetSRID(ST_MakePoint(100.5452, 13.7339), 4326), 4.00, 358, 1.5,  32.5, 76.0, 38.5,  85,  28.0, 44.0, 0.480, 7.00, 11.0),
(35, 9, (now()-interval '1 day'  +time '05:45')+interval '2864 sec', 2864, 13.7394, 100.5486, ST_SetSRID(ST_MakePoint(100.5486, 13.7394), 4326), 8.00, 358, 1.5,  32.5, 76.0, 38.5,  85,  28.0, 44.0, 0.480, 7.00, 11.0),
(36, 9, (now()-interval '1 day'  +time '05:45')+interval '4296 sec', 4296, 13.7450, 100.5520, ST_SetSRID(ST_MakePoint(100.5520, 13.7450), 4326), 12.00, 405, 1.5, 32.5, 76.0, 38.5,  85,  28.0, 44.0, 0.480, 7.00, 11.0),

-- session 10
(37, 10, (now()-interval '4 days' +time '06:00')+interval '0 sec',    0,   13.7520, 100.5000, ST_SetSRID(ST_MakePoint(100.5000, 13.7520), 4326),  0.00,   0, 2.1,  28.5, 63.0, 32.8,  44,  10.5, 17.0, 0.250, 3.80, 18.0),
(38, 10, (now()-interval '4 days' +time '06:00')+interval '645 sec',  645, 13.7533, 100.5013, ST_SetSRID(ST_MakePoint(100.5013, 13.7533), 4326),  1.83, 352, 2.1,  28.5, 63.0, 32.8,  44,  10.5, 17.0, 0.250, 3.80, 18.0),
(39, 10, (now()-interval '4 days' +time '06:00')+interval '1291 sec', 1291, 13.7547, 100.5027, ST_SetSRID(ST_MakePoint(100.5027, 13.7547), 4326), 3.67, 352, 2.1,  28.5, 63.0, 32.8,  44,  10.5, 17.0, 0.250, 3.80, 18.0),
(40, 10, (now()-interval '4 days' +time '06:00')+interval '1936 sec', 1936, 13.7560, 100.5040, ST_SetSRID(ST_MakePoint(100.5040, 13.7560), 4326), 5.50, 398, 2.1,  28.5, 63.0, 32.8,  44,  10.5, 17.0, 0.250, 3.80, 18.0);

SELECT setval(pg_get_serial_sequence('running.run_location_point', 'id'), 40);

-- ============================================================
-- RUNNING — run_watch_point  (biometric from smartwatch, 4 pts/session)
-- location_point_id 1-4 = session 1, 5-8 = session 2, ... 37-40 = session 10
-- ============================================================

INSERT INTO running.run_watch_point (
  location_point_id, recorded_at, elapsed_sec,
  heart_rate_bpm, blood_oxygen_pct, hrv_ms, vo2max, cadence_spm,
  respiratory_rate_bpm, calories_burned_kcal
) VALUES

-- session 1 (Pawin, avg vo2max ~48.50)
( 1, (now()-interval '1 day' +time '06:00')+interval '0 sec',    0,   142, 99.00, 52.00, 44.20, 155, 22.0,   0.00),
( 2, (now()-interval '1 day' +time '06:00')+interval '700 sec',  700, 152, 97.50, 30.00, 47.80, 166, 27.5, 124.00),
( 3, (now()-interval '1 day' +time '06:00')+interval '1400 sec', 1400, 162, 97.20, 22.00, 50.10, 170, 29.5, 247.00),
( 4, (now()-interval '1 day' +time '06:00')+interval '2100 sec', 2100, 174, 95.00, 18.00, 52.10, 180, 37.0, 371.00),

-- session 2 (Pawin)
( 5, (now()-interval '3 days'+time '06:15')+interval '0 sec',    0,   148, 98.80, 48.00, 44.20, 160, 24.0,   0.00),
( 6, (now()-interval '3 days'+time '06:15')+interval '1040 sec', 1040, 157, 97.20, 26.00, 47.50, 170, 29.0, 192.00),
( 7, (now()-interval '3 days'+time '06:15')+interval '2080 sec', 2080, 168, 97.00, 20.00, 50.20, 174, 31.5, 384.00),
( 8, (now()-interval '3 days'+time '06:15')+interval '3120 sec', 3120, 177, 94.50, 16.00, 52.10, 184, 39.0, 576.00),

-- session 3 (Pawin)
( 9, (now()-interval '5 days'+time '06:30')+interval '0 sec',    0,   138, 99.20, 55.00, 44.20, 152, 21.0,   0.00),
(10, (now()-interval '5 days'+time '06:30')+interval '560 sec',  560, 148, 97.50, 32.00, 47.00, 163, 26.0, 107.00),
(11, (now()-interval '5 days'+time '06:30')+interval '1120 sec', 1120, 158, 97.50, 24.00, 49.80, 167, 28.0, 215.00),
(12, (now()-interval '5 days'+time '06:30')+interval '1680 sec', 1680, 168, 95.50, 20.00, 52.10, 176, 35.0, 322.00),

-- session 4 (Pawin)
(13, (now()-interval '14 days'+time '06:00')+interval '0 sec',    0,   152, 98.50, 45.00, 44.20, 158, 25.0,   0.00),
(14, (now()-interval '14 days'+time '06:00')+interval '915 sec',  915, 160, 96.80, 26.00, 47.20, 168, 30.0, 166.00),
(15, (now()-interval '14 days'+time '06:00')+interval '1830 sec', 1830, 170, 96.50, 18.00, 50.00, 172, 33.0, 333.00),
(16, (now()-interval '14 days'+time '06:00')+interval '2745 sec', 2745, 180, 94.00, 15.00, 52.10, 182, 41.0, 499.00),

-- session 5 (Pawin)
(17, (now()-interval '20 days'+time '07:00')+interval '0 sec',    0,   155, 98.20, 42.00, 44.20, 162, 26.0,   0.00),
(18, (now()-interval '20 days'+time '07:00')+interval '1327 sec', 1327, 163, 96.80, 24.00, 47.60, 172, 31.0, 238.00),
(19, (now()-interval '20 days'+time '07:00')+interval '2653 sec', 2653, 172, 96.50, 17.00, 50.30, 176, 34.5, 476.00),
(20, (now()-interval '20 days'+time '07:00')+interval '3980 sec', 3980, 184, 93.50, 14.00, 52.10, 186, 43.0, 714.00),

-- session 6 (Pawin)
(21, (now()-interval '25 days'+time '06:45')+interval '0 sec',    0,   135, 99.50, 58.00, 44.20, 150, 20.0,   0.00),
(22, (now()-interval '25 days'+time '06:45')+interval '443 sec',  443, 145, 97.80, 34.00, 46.50, 160, 24.5,  76.00),
(23, (now()-interval '25 days'+time '06:45')+interval '885 sec',  885, 155, 97.80, 26.00, 49.00, 163, 26.0, 152.00),
(24, (now()-interval '25 days'+time '06:45')+interval '1328 sec', 1328, 164, 96.00, 22.00, 52.10, 173, 33.0, 228.00),

-- session 7 (Mali, avg vo2max ~42.70)
(25, (now()-interval '2 days' +time '06:30')+interval '0 sec',    0,   145, 99.00, 50.00, 39.50, 148, 22.5,   0.00),
(26, (now()-interval '2 days' +time '06:30')+interval '571 sec',  571, 157, 97.20, 28.00, 41.80, 158, 28.0,  73.00),
(27, (now()-interval '2 days' +time '06:30')+interval '1141 sec', 1141, 165, 97.00, 21.00, 43.50, 162, 30.0, 145.00),
(28, (now()-interval '2 days' +time '06:30')+interval '1712 sec', 1712, 176, 94.50, 17.00, 46.30, 172, 38.0, 218.00),

-- session 8 (Mali)
(29, (now()-interval '7 days' +time '06:00')+interval '0 sec',    0,   150, 98.80, 46.00, 39.50, 150, 24.5,   0.00),
(30, (now()-interval '7 days' +time '06:00')+interval '958 sec',  958, 161, 97.00, 26.00, 41.60, 161, 29.5, 118.00),
(31, (now()-interval '7 days' +time '06:00')+interval '1915 sec', 1915, 170, 96.80, 19.00, 43.80, 165, 32.0, 236.00),
(32, (now()-interval '7 days' +time '06:00')+interval '2873 sec', 2873, 179, 94.00, 15.50, 46.30, 175, 40.5, 354.00),

-- session 9 (Niran, avg vo2max ~51.20)
(33, (now()-interval '1 day'  +time '05:45')+interval '0 sec',    0,   148, 99.10, 48.00, 47.00, 165, 23.0,   0.00),
(34, (now()-interval '1 day'  +time '05:45')+interval '1432 sec', 1432, 155, 97.50, 28.00, 50.20, 174, 28.5, 285.00),
(35, (now()-interval '1 day'  +time '05:45')+interval '2864 sec', 2864, 165, 97.30, 21.00, 53.40, 178, 30.5, 569.00),
(36, (now()-interval '1 day'  +time '05:45')+interval '4296 sec', 4296, 175, 95.00, 17.00, 55.60, 188, 38.5, 854.00),

-- session 10 (Niran)
(37, (now()-interval '4 days' +time '06:00')+interval '0 sec',    0,   142, 99.30, 54.00, 47.00, 163, 21.5,   0.00),
(38, (now()-interval '4 days' +time '06:00')+interval '645 sec',  645, 150, 97.80, 32.00, 50.00, 172, 26.5, 132.00),
(39, (now()-interval '4 days' +time '06:00')+interval '1291 sec', 1291, 159, 97.60, 24.00, 53.20, 176, 28.5, 265.00),
(40, (now()-interval '4 days' +time '06:00')+interval '1936 sec', 1936, 170, 95.50, 19.00, 55.60, 186, 36.5, 397.00);

