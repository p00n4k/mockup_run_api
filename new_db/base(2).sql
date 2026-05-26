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
  duration_sec int,
  avg_pace_sec int,
  min_pace_sec int,
  max_pace_sec int,
  route_geojson json,
  route_polyline varchar(2000), -- original Google encoded polyline
  route_geom geometry(LineString, 4326), -- queryable route

  CONSTRAINT fk_run_sessions_user
    FOREIGN KEY (user_id)
    REFERENCES identity.users(id)
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
-- Source of truth for route, distance, start/end coordinates, and environment readings.
CREATE TABLE running.run_location_point (
  id BIGSERIAL PRIMARY KEY,
  session_id int NOT NULL,
  recorded_at timestamp NOT NULL,
  elapsed_sec int NOT NULL,            -- seconds since session start
  lat decimal(10,7),
  lng decimal(10,7),
  geom geometry(Point, 4326),
  distance_km decimal(6,3),            -- cumulative distance from the device/app
  current_pace_sec int,                -- sec/km at this moment
  elevation_m decimal(7,2),            -- from GPS or Elevation API
  temperature decimal(5,2),
  humidity decimal(5,2),
  feels_like decimal(5,2),             -- used as heat_index if no separate heat index exists
  aqi int,
  pm25 decimal(6,2),
  pm10 decimal(6,2),
  co decimal(8,3),
  uv_index decimal(4,2),
  wind_speed decimal(5,2),
  wind_direction decimal(5,2),
  cloud_cover_pct decimal(5,2),
  rain_probability decimal(5,2),

  CONSTRAINT fk_run_location_point_session
    FOREIGN KEY (session_id)
    REFERENCES running.run_sessions(id)
    DEFERRABLE INITIALLY IMMEDIATE,

  CONSTRAINT uq_run_location_point_session_elapsed
    UNIQUE (session_id, elapsed_sec)
);

-- biometric data streamed from smartwatch (1-to-1 with run_location_point)
-- calories_burned_kcal is the cumulative value sent by the smartwatch.
CREATE TABLE running.run_watch_point (
  id BIGSERIAL PRIMARY KEY,
  location_point_id bigint UNIQUE NOT NULL,
  recorded_at timestamp NOT NULL,
  elapsed_sec int NOT NULL,            -- seconds since session start
  heart_rate_bpm int,
  blood_oxygen_pct decimal(5,2),
  hrv_ms decimal(6,2),
  vo2max decimal(5,2),
  cadence_spm int,
  respiratory_rate_bpm decimal(5,2),
  calories_burned_kcal decimal(8,2),   -- cumulative from smartwatch

  CONSTRAINT fk_run_watch_point_location_point
    FOREIGN KEY (location_point_id)
    REFERENCES running.run_location_point(id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_run_sessions_user_started_at
  ON running.run_sessions (user_id, started_at DESC);

CREATE INDEX idx_run_location_point_session_elapsed
  ON running.run_location_point (session_id, elapsed_sec);

CREATE INDEX idx_run_location_point_geom
  ON running.run_location_point USING GIST (geom);

CREATE INDEX idx_run_sessions_route_geom
  ON running.run_sessions USING GIST (route_geom);

CREATE INDEX idx_run_watch_point_elapsed
  ON running.run_watch_point (elapsed_sec);

-- Derived environment summary. Do not insert into this view.
CREATE VIEW running.run_environment_summary AS
SELECT
  lp.session_id,
  ROUND(AVG(lp.feels_like)::numeric, 2)::decimal(5,2)       AS avg_heat_index,
  MIN(lp.feels_like)::decimal(5,2)                          AS min_heat_index,
  MAX(lp.feels_like)::decimal(5,2)                          AS max_heat_index,
  ROUND(AVG(lp.feels_like)::numeric, 2)::decimal(5,2)       AS avg_feels_like,
  MIN(lp.feels_like)::decimal(5,2)                          AS min_feels_like,
  MAX(lp.feels_like)::decimal(5,2)                          AS max_feels_like,
  ROUND(AVG(lp.temperature)::numeric, 2)::decimal(5,2)      AS avg_temperature,
  MIN(lp.temperature)::decimal(5,2)                         AS min_temperature,
  MAX(lp.temperature)::decimal(5,2)                         AS max_temperature,
  ROUND(AVG(lp.humidity)::numeric, 2)::decimal(5,2)         AS avg_humidity,
  MIN(lp.humidity)::decimal(5,2)                            AS min_humidity,
  MAX(lp.humidity)::decimal(5,2)                            AS max_humidity,
  ROUND(AVG(lp.pm25)::numeric, 2)::decimal(6,2)             AS avg_pm25,
  MIN(lp.pm25)::decimal(6,2)                                AS min_pm25,
  MAX(lp.pm25)::decimal(6,2)                                AS max_pm25,
  ROUND(AVG(lp.pm10)::numeric, 2)::decimal(6,2)             AS avg_pm10,
  MIN(lp.pm10)::decimal(6,2)                                AS min_pm10,
  MAX(lp.pm10)::decimal(6,2)                                AS max_pm10,
  ROUND(AVG(lp.co)::numeric, 3)::decimal(8,3)               AS avg_co,
  MIN(lp.co)::decimal(8,3)                                  AS min_co,
  MAX(lp.co)::decimal(8,3)                                  AS max_co,
  ROUND(AVG(lp.aqi))::int                                   AS avg_aqi,
  MIN(lp.aqi)::int                                          AS min_aqi,
  MAX(lp.aqi)::int                                          AS max_aqi,
  ROUND(AVG(lp.uv_index)::numeric, 2)::decimal(4,2)         AS avg_uv_index,
  MIN(lp.uv_index)::decimal(4,2)                            AS min_uv_index,
  MAX(lp.uv_index)::decimal(4,2)                            AS max_uv_index,
  ROUND(AVG(lp.wind_speed)::numeric, 2)::decimal(5,2)       AS avg_wind_speed,
  MIN(lp.wind_speed)::decimal(5,2)                          AS min_wind_speed,
  MAX(lp.wind_speed)::decimal(5,2)                          AS max_wind_speed,
  ROUND(AVG(lp.cloud_cover_pct)::numeric, 2)::decimal(5,2)  AS avg_cloud_cover_pct,
  MIN(lp.cloud_cover_pct)::decimal(5,2)                     AS min_cloud_cover_pct,
  MAX(lp.cloud_cover_pct)::decimal(5,2)                     AS max_cloud_cover_pct
FROM running.run_location_point lp
GROUP BY lp.session_id;

-- Derived smartwatch summary. Do not insert into this view.
-- calories_burned_kcal is calculated from the latest cumulative smartwatch point.
CREATE VIEW identity.run_smart_watch_summary AS
SELECT
  lp.session_id,
  ROUND(AVG(wp.heart_rate_bpm))::int                        AS avg_heart_rate_bpm,
  MIN(wp.heart_rate_bpm)::int                               AS min_heart_rate_bpm,
  MAX(wp.heart_rate_bpm)::int                               AS max_heart_rate_bpm,
  ROUND(AVG(wp.blood_oxygen_pct)::numeric, 2)::decimal(5,2) AS avg_blood_oxygen_pct,
  MIN(wp.blood_oxygen_pct)::decimal(5,2)                    AS min_blood_oxygen_pct,
  MAX(wp.blood_oxygen_pct)::decimal(5,2)                    AS max_blood_oxygen_pct,
  ROUND(AVG(wp.respiratory_rate_bpm)::numeric, 2)::decimal(5,2) AS avg_respiratory_rate_bpm,
  MIN(wp.respiratory_rate_bpm)::decimal(5,2)                AS min_respiratory_rate_bpm,
  MAX(wp.respiratory_rate_bpm)::decimal(5,2)                AS max_respiratory_rate_bpm,
  ROUND(AVG(wp.hrv_ms)::numeric, 2)::decimal(6,2)           AS avg_hrv_ms,
  MIN(wp.hrv_ms)::decimal(6,2)                              AS min_hrv_ms,
  MAX(wp.hrv_ms)::decimal(6,2)                              AS max_hrv_ms,
  ROUND(AVG(wp.cadence_spm))::int                           AS avg_cadence_spm,
  MIN(wp.cadence_spm)::int                                  AS min_cadence_spm,
  MAX(wp.cadence_spm)::int                                  AS max_cadence_spm,
  MAX(wp.calories_burned_kcal)::int                         AS calories_burned_kcal,
  MAX(wp.calories_burned_kcal)::int                         AS active_energy_kcal,
  NULL::decimal(6,2)                                        AS training_load,
  NULL::int                                                 AS recovery_time_hr
FROM running.run_watch_point wp
JOIN running.run_location_point lp
  ON lp.id = wp.location_point_id
GROUP BY lp.session_id;
