CREATE SCHEMA identity;
CREATE SCHEMA running;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE identity.users (
  id SERIAL PRIMARY KEY,
  email varchar(255) UNIQUE NOT NULL,
  name varchar(100) NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE identity.user_profiles (
  id SERIAL PRIMARY KEY,
  user_id int UNIQUE NOT NULL,
  birthday date,
  gender varchar(30),
  height_cm decimal(5,2),
  weight_kg decimal(5,2),
  step_length_cm decimal(5,2),
  stride_length_cm decimal(5,2),
  preferred_units varchar(20) DEFAULT 'metric',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT fk_user_profiles_user
    FOREIGN KEY (user_id)
    REFERENCES identity.users(id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE identity.user_health_stats_smart_watch (
  id SERIAL PRIMARY KEY,
  user_id int UNIQUE NOT NULL,
  resting_heart_rate_bpm int,
  max_heart_rate_bpm int,
  min_heart_rate_bpm int,
  avg_heart_rate_bpm int,
  vo2max decimal(5,2),
  min_vo2max decimal(5,2),
  max_vo2max decimal(5,2),
  avg_vo2max decimal(5,2),
  blood_oxygen_pct decimal(5,2),
  min_blood_oxygen_pct decimal(5,2),
  max_blood_oxygen_pct decimal(5,2),
  avg_blood_oxygen_pct decimal(5,2),
  respiratory_rate_bpm decimal(5,2),
  min_respiratory_rate_bpm decimal(5,2),
  max_respiratory_rate_bpm decimal(5,2),
  avg_respiratory_rate_bpm decimal(5,2),
  basal_metabolic_rate_kcal int,
  active_energy_kcal_avg int,
  min_active_energy_kcal int,
  max_active_energy_kcal int,
  sleep_duration_min_avg int,
  min_sleep_duration_min int,
  max_sleep_duration_min int,
  sleep_score_avg decimal(5,2),
  min_sleep_score decimal(5,2),
  max_sleep_score decimal(5,2),
  stats_period_start timestamp,
  stats_period_end timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT fk_user_health_stats_smart_watch_user
    FOREIGN KEY (user_id)
    REFERENCES identity.users(id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE running.run_sessions (
  id SERIAL PRIMARY KEY,
  user_id int NOT NULL,
  started_at timestamp NOT NULL,
  ended_at timestamp,
  distance_km decimal(6,2),
  duration_sec int,
  avg_pace_sec int,
  min_pace_sec int,
  max_pace_sec int,
  start_lat decimal(10,7),
  start_lng decimal(10,7),
  end_lat decimal(10,7),
  end_lng decimal(10,7),
  route_geojson json,
  route_polyline varchar(2000), -- original Google encoded polyline
  route_geom geometry(LineString, 4326), -- queryable route

  CONSTRAINT fk_run_sessions_user
    FOREIGN KEY (user_id)
    REFERENCES identity.users(id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE identity.run_smart_watch_summary (
  id SERIAL PRIMARY KEY,
  session_id int UNIQUE NOT NULL,
  avg_heart_rate_bpm int,
  min_heart_rate_bpm int,
  max_heart_rate_bpm int,
  avg_blood_oxygen_pct decimal(5,2),
  min_blood_oxygen_pct decimal(5,2),
  max_blood_oxygen_pct decimal(5,2),
  avg_respiratory_rate_bpm decimal(5,2),
  min_respiratory_rate_bpm decimal(5,2),
  max_respiratory_rate_bpm decimal(5,2),
  avg_hrv_ms decimal(6,2),
  min_hrv_ms decimal(6,2),
  max_hrv_ms decimal(6,2),
  avg_cadence_spm int,
  min_cadence_spm int,
  max_cadence_spm int,
  calories_burned_kcal int,
  active_energy_kcal int,
  training_load decimal(6,2),
  recovery_time_hr int,
  created_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT fk_run_smart_watch_summary_session
    FOREIGN KEY (session_id)
    REFERENCES running.run_sessions(id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE running.run_environment_summary (
  id SERIAL PRIMARY KEY,
  session_id int UNIQUE NOT NULL,
  avg_heat_index decimal(5,2),
  min_heat_index decimal(5,2),
  max_heat_index decimal(5,2),
  avg_feels_like decimal(5,2),
  min_feels_like decimal(5,2),
  max_feels_like decimal(5,2),
  avg_temperature decimal(5,2),
  min_temperature decimal(5,2),
  max_temperature decimal(5,2),
  avg_humidity decimal(5,2),
  min_humidity decimal(5,2),
  max_humidity decimal(5,2),
  avg_pm25 decimal(6,2),
  min_pm25 decimal(6,2),
  max_pm25 decimal(6,2),
  avg_pm10 decimal(6,2),
  min_pm10 decimal(6,2),
  max_pm10 decimal(6,2),
  avg_co decimal(8,3),
  min_co decimal(8,3),
  max_co decimal(8,3),
  avg_aqi int,
  min_aqi int,
  max_aqi int,
  avg_uv_index decimal(4,2),
  min_uv_index decimal(4,2),
  max_uv_index decimal(4,2),
  avg_wind_speed decimal(5,2),
  min_wind_speed decimal(5,2),
  max_wind_speed decimal(5,2),
  avg_cloud_cover_pct decimal(5,2),
  min_cloud_cover_pct decimal(5,2),
  max_cloud_cover_pct decimal(5,2),

  CONSTRAINT fk_run_environment_summary_session
    FOREIGN KEY (session_id)
    REFERENCES running.run_sessions(id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE running.run_scores (
  id SERIAL PRIMARY KEY,
  session_id int UNIQUE NOT NULL,
  overall_score decimal(5,2) NOT NULL,
  heat_score decimal(5,2),
  air_quality_score decimal(5,2),
  uv_score decimal(5,2),
  wind_score decimal(5,2),
  humidity_score decimal(5,2),
  cloud_score decimal(5,2),
  grade varchar(20),
  calories_burned_kcal int,
  calculated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT fk_run_scores_session
    FOREIGN KEY (session_id)
    REFERENCES running.run_sessions(id)
    DEFERRABLE INITIALLY IMMEDIATE
);

-- location + environment data from GPS device / external API
CREATE TABLE running.run_location_point (
  id BIGSERIAL PRIMARY KEY,
  session_id int NOT NULL,
  recorded_at timestamp NOT NULL,
  elapsed_sec int,                    -- seconds since session start
  lat decimal(10,7),
  lng decimal(10,7),
  geom geometry(Point, 4326),
  distance_km decimal(6,3),           -- cumulative distance
  current_pace_sec int,               -- sec/km at this moment
  elevation_m decimal(7,2),           -- from GPS or Elevation API
  temperature decimal(5,2),
  humidity decimal(5,2),
  feels_like decimal(5,2),
  aqi int,
  pm25 decimal(6,2),
  pm10 decimal(6,2),
  co decimal(8,3),
  uv_index decimal(4,2),
  wind_speed decimal(5,2),

  CONSTRAINT fk_run_location_point_session
    FOREIGN KEY (session_id)
    REFERENCES running.run_sessions(id)
    DEFERRABLE INITIALLY IMMEDIATE
);

-- biometric data streamed from smartwatch (1-to-1 with run_location_point)
CREATE TABLE running.run_watch_point (
  id BIGSERIAL PRIMARY KEY,
  location_point_id bigint UNIQUE NOT NULL,
  recorded_at timestamp NOT NULL,
  elapsed_sec int,                    -- seconds since session start
  heart_rate_bpm int,
  blood_oxygen_pct decimal(5,2),
  hrv_ms decimal(6,2),
  vo2max decimal(5,2),
  cadence_spm int,
  respiratory_rate_bpm decimal(5,2),
  calories_burned_kcal decimal(6,2),  -- cumulative

  CONSTRAINT fk_run_watch_point_location_point
    FOREIGN KEY (location_point_id)
    REFERENCES running.run_location_point(id)
    DEFERRABLE INITIALLY IMMEDIATE
);