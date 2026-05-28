// ── index.js — Flood Run API (v2, new_db schema) ─────────────────────────────
// Schema changes vs v1:
//   run_sessions      : removed distance_km, start_lat, start_lng, end_lat, end_lng
//   run_environment_summary : now a VIEW — no INSERT, derived from run_location_point
//   run_smart_watch_summary : now a VIEW in identity schema — no INSERT
//   run_location_point: added wind_direction, cloud_cover_pct, rain_probability
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Dev bypass ───────────────────────────────────────────────────────────────
// In dev mode auth middleware sets user_id = 1 — no real token needed.
const DEV_USER_ID = 1;

function createAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, type: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  req.user = { id: DEV_USER_ID };
  next();
}

// ── AUTH ─────────────────────────────────────────────────────────────────────

app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query(
      `SELECT id, email, name FROM identity.users WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const user = result.rows[0];
    return res.json({
      accessToken: createAccessToken(user),
      refreshToken: createRefreshToken(user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/v1/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (payload.type !== "refresh") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    const result = await pool.query(
      `SELECT id, email, name FROM identity.users WHERE id = $1 LIMIT 1`,
      [payload.userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }
    return res.json({ accessToken: createAccessToken(result.rows[0]) });
  } catch (err) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

app.post("/api/v1/auth/logout", auth, (req, res) => {
  return res.json({ message: "Logged out successfully" });
});

// ── USER ──────────────────────────────────────────────────────────────────────

app.get("/api/v1/users/me", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, NULL AS profile_image_url
       FROM identity.users WHERE id = $1 LIMIT 1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get current user" });
  }
});

app.get("/api/v1/users/me/profile", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id, u.name, u.email,
        up.birthday, up.gender, up.height_cm, up.weight_kg,
        up.step_length_cm, up.stride_length_cm, up.preferred_units,
        uhs.resting_heart_rate_bpm, uhs.max_heart_rate_bpm,
        uhs.min_heart_rate_bpm, uhs.avg_heart_rate_bpm,
        uhs.vo2max, uhs.blood_oxygen_pct, uhs.respiratory_rate_bpm,
        uhs.basal_metabolic_rate_kcal, uhs.active_energy_kcal_avg,
        uhs.sleep_duration_min_avg, uhs.sleep_score_avg,
        uhs.stats_period_start, uhs.stats_period_end
      FROM identity.users u
      LEFT JOIN identity.user_profiles up ON up.user_id = u.id
      LEFT JOIN identity.user_health_stats_smart_watch uhs ON uhs.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
      `,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const scoresResult = await pool.query(
      `
      SELECT
        ROUND(AVG(res.overall_score)::numeric, 2) AS score_all_time,
        ROUND(AVG(res.overall_score) FILTER (WHERE rs.started_at >= NOW() - INTERVAL '1 year')::numeric,  2) AS score_yearly,
        ROUND(AVG(res.overall_score) FILTER (WHERE rs.started_at >= NOW() - INTERVAL '1 month')::numeric, 2) AS score_monthly,
        ROUND(AVG(res.overall_score) FILTER (WHERE rs.started_at >= NOW() - INTERVAL '7 days')::numeric,  2) AS score_weekly
      FROM running.run_sessions rs
      JOIN running.run_scores res ON res.session_id = rs.id
      WHERE rs.user_id = $1
      `,
      [req.user.id]
    );

    return res.json({ ...result.rows[0], environment_scores: scoresResult.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get profile" });
  }
});

app.post("/api/v1/users/me/profile", auth, async (req, res) => {
  const {
    name, profile_image_url,
    birthday, gender, height_cm, weight_kg,
    step_length_cm, stride_length_cm, preferred_units,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (name !== undefined) {
      await client.query(
        `UPDATE identity.users SET name = $1 WHERE id = $2`,
        [name, req.user.id]
      );
    }

    await client.query(
      `
      INSERT INTO identity.user_profiles
        (user_id, birthday, gender, height_cm, weight_kg,
         step_length_cm, stride_length_cm, preferred_units)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        birthday         = COALESCE(EXCLUDED.birthday,          identity.user_profiles.birthday),
        gender           = COALESCE(EXCLUDED.gender,            identity.user_profiles.gender),
        height_cm        = COALESCE(EXCLUDED.height_cm,         identity.user_profiles.height_cm),
        weight_kg        = COALESCE(EXCLUDED.weight_kg,         identity.user_profiles.weight_kg),
        step_length_cm   = COALESCE(EXCLUDED.step_length_cm,    identity.user_profiles.step_length_cm),
        stride_length_cm = COALESCE(EXCLUDED.stride_length_cm,  identity.user_profiles.stride_length_cm),
        preferred_units  = COALESCE(EXCLUDED.preferred_units,   identity.user_profiles.preferred_units),
        updated_at       = now()
      `,
      [
        req.user.id,
        birthday ?? null, gender ?? null, height_cm ?? null, weight_kg ?? null,
        step_length_cm ?? null, stride_length_cm ?? null, preferred_units ?? null,
      ]
    );

    await client.query("COMMIT");

    const result = await client.query(
      `
      SELECT u.id, u.name, u.email,
        up.birthday, up.gender, up.height_cm, up.weight_kg,
        up.step_length_cm, up.stride_length_cm, up.preferred_units
      FROM identity.users u
      LEFT JOIN identity.user_profiles up ON up.user_id = u.id
      WHERE u.id = $1 LIMIT 1
      `,
      [req.user.id]
    );

    return res.json({ ...result.rows[0], profile_image_url: profile_image_url ?? null });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ message: "Failed to update profile" });
  } finally {
    client.release();
  }
});

// ── RUN ───────────────────────────────────────────────────────────────────────
// NOTE: distance_km, start_lat/lng, end_lat/lng are no longer stored in
// run_sessions — they are derived from run_location_point via lateral joins.

/**
 * GET /api/v1/run/session_history
 * Query: startDate, endDate, page, limit, offset
 */
app.get("/api/v1/run/session_history", auth, async (req, res) => {
  try {
    const { startDate, endDate, page, limit = 10, offset: rawOffset } = req.query;
    const offset = rawOffset !== undefined
      ? parseInt(rawOffset)
      : (parseInt(page ?? 1) - 1) * parseInt(limit);

    const params = [req.user.id];
    let whereExtra = "";
    if (startDate) { params.push(startDate); whereExtra += ` AND rs.started_at >= $${params.length}`; }
    if (endDate)   { params.push(endDate);   whereExtra += ` AND rs.started_at <= $${params.length}`; }

    const limitIdx  = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(parseInt(limit), offset);

    const result = await pool.query(
      `
      SELECT
        rs.id,
        rs.started_at,
        rs.ended_at,
        lp_agg.distance_km,
        rs.duration_sec,
        rs.avg_pace_sec,
        res.overall_score,
        res.grade
      FROM running.run_sessions rs
      LEFT JOIN LATERAL (
        SELECT MAX(lp.distance_km) AS distance_km
        FROM running.run_location_point lp
        WHERE lp.session_id = rs.id
      ) lp_agg ON true
      LEFT JOIN running.run_scores res ON res.session_id = rs.id
      WHERE rs.user_id = $1${whereExtra}
      ORDER BY rs.started_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get session history" });
  }
});

/**
 * GET /api/v1/run/session/:id
 * Session overview: basic stats + environment scores
 */
app.get("/api/v1/run/session/:id", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        rs.id,
        rs.started_at,
        rs.ended_at,
        lp_agg.distance_km,
        rs.duration_sec,
        rs.avg_pace_sec,
        rs.min_pace_sec,
        rs.max_pace_sec,
        lp_first.lat AS start_lat,
        lp_first.lng AS start_lng,
        lp_last.lat  AS end_lat,
        lp_last.lng  AS end_lng,
        res.overall_score,
        res.grade,
        res.heat_score,
        res.air_quality_score,
        res.uv_score,
        res.wind_score,
        res.humidity_score,
        res.cloud_score,
        res.calories_burned_kcal
      FROM running.run_sessions rs
      LEFT JOIN LATERAL (
        SELECT MAX(lp.distance_km) AS distance_km
        FROM running.run_location_point lp WHERE lp.session_id = rs.id
      ) lp_agg ON true
      LEFT JOIN LATERAL (
        SELECT lat, lng FROM running.run_location_point
        WHERE session_id = rs.id ORDER BY elapsed_sec ASC LIMIT 1
      ) lp_first ON true
      LEFT JOIN LATERAL (
        SELECT lat, lng FROM running.run_location_point
        WHERE session_id = rs.id ORDER BY elapsed_sec DESC LIMIT 1
      ) lp_last ON true
      LEFT JOIN running.run_scores res ON res.session_id = rs.id
      WHERE rs.id = $1 AND rs.user_id = $2
      LIMIT 1
      `,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get session" });
  }
});

/**
 * GET /api/v1/run/session/:id/route
 * Route geometry + per-minute coordinate/pace/elevation points
 */
app.get("/api/v1/run/session/:id/route", auth, async (req, res) => {
  try {
    const sessionResult = await pool.query(
      `
      SELECT rs.id, rs.route_geojson, rs.route_polyline,
        ST_AsGeoJSON(rs.route_geom)::json AS route_geom
      FROM running.run_sessions rs
      WHERE rs.id = $1 AND rs.user_id = $2 LIMIT 1
      `,
      [req.params.id, req.user.id]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const pointsResult = await pool.query(
      `
      SELECT id, elapsed_sec, recorded_at, lat, lng,
             distance_km, current_pace_sec, elevation_m
      FROM running.run_location_point
      WHERE session_id = $1
      ORDER BY elapsed_sec
      `,
      [req.params.id]
    );

    const session = sessionResult.rows[0];
    return res.json({
      session_id: session.id,
      route_geojson: session.route_geojson,
      route_polyline: session.route_polyline,
      route_geom: session.route_geom,
      coordinates: pointsResult.rows.map((r) => [parseFloat(r.lat), parseFloat(r.lng)]),
      points: pointsResult.rows.map((r) => ({
        id: r.id,
        elapsed_sec: r.elapsed_sec,
        recorded_at: r.recorded_at,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
        distance_km:      r.distance_km      !== null ? parseFloat(r.distance_km)  : null,
        current_pace_sec: r.current_pace_sec,
        elevation_m:      r.elevation_m      !== null ? parseFloat(r.elevation_m)  : null,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get session route" });
  }
});

/**
 * GET /api/v1/run/session/:id/env
 * Environment summary (VIEW) + per-minute env readings
 * Includes wind_direction, cloud_cover_pct, rain_probability per point
 */
app.get("/api/v1/run/session/:id/env", auth, async (req, res) => {
  try {
    const ownerCheck = await pool.query(
      `SELECT id FROM running.run_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const [summaryResult, pointsResult] = await Promise.all([
      pool.query(
        `
        SELECT
          avg_heat_index,  min_heat_index,  max_heat_index,
          avg_feels_like,  min_feels_like,  max_feels_like,
          avg_temperature, min_temperature, max_temperature,
          avg_humidity,    min_humidity,    max_humidity,
          avg_pm25,        min_pm25,        max_pm25,
          avg_pm10,        min_pm10,        max_pm10,
          avg_co,          min_co,          max_co,
          avg_aqi,         min_aqi,         max_aqi,
          avg_uv_index,    min_uv_index,    max_uv_index,
          avg_wind_speed,  min_wind_speed,  max_wind_speed,
          avg_cloud_cover_pct, min_cloud_cover_pct, max_cloud_cover_pct
        FROM running.run_environment_summary
        WHERE session_id = $1
        LIMIT 1
        `,
        [req.params.id]
      ),
      pool.query(
        `
        SELECT
          id, elapsed_sec, recorded_at,
          temperature, humidity, feels_like,
          aqi, pm25, pm10, co, uv_index,
          wind_speed, wind_direction, cloud_cover_pct, rain_probability
        FROM running.run_location_point
        WHERE session_id = $1
        ORDER BY elapsed_sec
        `,
        [req.params.id]
      ),
    ]);

    return res.json({
      session_id: parseInt(req.params.id),
      summary: summaryResult.rows[0] ?? null,
      points: pointsResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get session environment data" });
  }
});

/**
 * GET /api/v1/run/session/:id/biometric
 * Smartwatch summary (VIEW) + per-minute biometric readings
 */
app.get("/api/v1/run/session/:id/biometric", auth, async (req, res) => {
  try {
    const ownerCheck = await pool.query(
      `SELECT id FROM running.run_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const [summaryResult, pointsResult] = await Promise.all([
      pool.query(
        `
        SELECT
          avg_heart_rate_bpm,       min_heart_rate_bpm,       max_heart_rate_bpm,
          avg_blood_oxygen_pct,     min_blood_oxygen_pct,     max_blood_oxygen_pct,
          avg_respiratory_rate_bpm, min_respiratory_rate_bpm, max_respiratory_rate_bpm,
          avg_hrv_ms,               min_hrv_ms,               max_hrv_ms,
          avg_cadence_spm,          min_cadence_spm,           max_cadence_spm,
          calories_burned_kcal,
          active_energy_kcal,
          training_load,
          recovery_time_hr
        FROM identity.run_smart_watch_summary
        WHERE session_id = $1
        LIMIT 1
        `,
        [req.params.id]
      ),
      pool.query(
        `
        SELECT
          wp.id, wp.elapsed_sec, wp.recorded_at,
          wp.heart_rate_bpm, wp.blood_oxygen_pct, wp.hrv_ms,
          wp.vo2max, wp.cadence_spm, wp.respiratory_rate_bpm,
          wp.calories_burned_kcal
        FROM running.run_watch_point wp
        JOIN running.run_location_point lp ON lp.id = wp.location_point_id
        WHERE lp.session_id = $1
        ORDER BY wp.elapsed_sec
        `,
        [req.params.id]
      ),
    ]);

    return res.json({
      session_id: parseInt(req.params.id),
      summary: summaryResult.rows[0] ?? null,
      points: pointsResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get session biometric data" });
  }
});

/**
 * GET /api/v1/run/weekly
 */
app.get("/api/v1/run/weekly", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        COALESCE(SUM(lp_agg.distance_km), 0)::float AS total_distance_km,
        COUNT(rs.id)::int                            AS total_sessions,
        COALESCE(AVG(rs.avg_pace_sec), 0)::int       AS avg_pace_sec
      FROM running.run_sessions rs
      LEFT JOIN LATERAL (
        SELECT MAX(lp.distance_km) AS distance_km
        FROM running.run_location_point lp WHERE lp.session_id = rs.id
      ) lp_agg ON true
      WHERE rs.user_id = $1
        AND rs.started_at >= NOW() - INTERVAL '7 days'
      `,
      [req.user.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get weekly summary" });
  }
});

/**
 * GET /api/v1/run/monthly
 * Query: year, month (1-12)
 */
app.get("/api/v1/run/monthly", auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ message: "year and month are required" });
    }
    const result = await pool.query(
      `
      SELECT
        COALESCE(SUM(lp_agg.distance_km), 0)::float AS total_distance_km,
        COUNT(rs.id)::int                            AS total_sessions,
        COALESCE(SUM(rs.duration_sec), 0)::int       AS total_duration_sec,
        COALESCE(AVG(rs.avg_pace_sec), 0)::int       AS avg_pace_sec,
        ROUND(MAX(rsc.overall_score)::numeric, 2)    AS best_score,
        ROUND(AVG(rsc.overall_score)::numeric, 2)    AS avg_score
      FROM running.run_sessions rs
      LEFT JOIN LATERAL (
        SELECT MAX(lp.distance_km) AS distance_km
        FROM running.run_location_point lp WHERE lp.session_id = rs.id
      ) lp_agg ON true
      LEFT JOIN running.run_scores rsc ON rsc.session_id = rs.id
      WHERE rs.user_id = $1
        AND EXTRACT(YEAR  FROM rs.started_at) = $2
        AND EXTRACT(MONTH FROM rs.started_at) = $3
      `,
      [req.user.id, parseInt(year), parseInt(month)]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get monthly summary" });
  }
});

/**
 * GET /api/v1/run/nearby
 * Query: lat, lng, radius_km (default 5), limit (default 10)
 */
app.get("/api/v1/run/nearby", auth, async (req, res) => {
  try {
    const { lat, lng, radius_km = 5, limit = 10 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const result = await pool.query(
      `
      SELECT
        rs.id,
        rs.started_at,
        lp_agg.distance_km,
        rs.duration_sec,
        rs.avg_pace_sec,
        lp_first.lat AS start_lat,
        lp_first.lng AS start_lng,
        rs.route_polyline,
        res.overall_score,
        res.grade,
        ROUND((ST_Distance(
          rs.route_geom::geography,
          ST_SetSRID(ST_MakePoint($2::float, $1::float), 4326)::geography
        ) / 1000)::numeric, 2) AS nearest_distance_km
      FROM running.run_sessions rs
      LEFT JOIN LATERAL (
        SELECT MAX(lp.distance_km) AS distance_km
        FROM running.run_location_point lp WHERE lp.session_id = rs.id
      ) lp_agg ON true
      LEFT JOIN LATERAL (
        SELECT lat, lng FROM running.run_location_point
        WHERE session_id = rs.id ORDER BY elapsed_sec ASC LIMIT 1
      ) lp_first ON true
      LEFT JOIN running.run_scores res ON res.session_id = rs.id
      WHERE rs.user_id = $4
        AND rs.route_geom IS NOT NULL
        AND ST_DWithin(
          rs.route_geom::geography,
          ST_SetSRID(ST_MakePoint($2::float, $1::float), 4326)::geography,
          $3::float * 1000
        )
      ORDER BY nearest_distance_km
      LIMIT $5
      `,
      [parseFloat(lat), parseFloat(lng), parseFloat(radius_km), req.user.id, parseInt(limit)]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to find nearby sessions" });
  }
});

/**
 * GET /api/v1/run/env  (Public)
 * Mock environment data for a given lat/lng
 */
app.get("/api/v1/run/env", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ message: "lat and lng are required" });
  }
  return res.json({
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    temperature: 32.5,
    feels_like: 38.2,
    heat_index: 38.2,
    humidity: 72,
    pm25: 24.5,
    pm10: 38.0,
    co: 0.42,
    aqi: 75,
    uv_index: 7.2,
    wind_speed: 12.0,
    wind_direction: 180,
    cloud_cover_pct: 35,
    rain_probability: 20,
    recorded_at: new Date().toISOString(),
  });
});

/**
 * POST /api/v1/run/submit
 *
 * Device sends all data in one request when the run finishes.
 * watch_points is optional (omit or send [] if no smartwatch).
 * If provided, watch_points must have the same length as location_points (1-to-1).
 *
 * run_environment_summary and run_smart_watch_summary are VIEWs — no manual
 * insert needed; they auto-aggregate from run_location_point / run_watch_point.
 */
app.post("/api/v1/run/submit", auth, async (req, res) => {
  const {
    started_at,
    ended_at,
    duration_sec,
    avg_pace_sec,
    min_pace_sec,
    max_pace_sec,
    route_polyline,
    location_points = [],
    watch_points = [],
  } = req.body;

  const hasWatchData = watch_points.length > 0;
  if (hasWatchData && watch_points.length !== location_points.length) {
    return res.status(400).json({
      message: "watch_points must have the same length as location_points",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. INSERT run_sessions ────────────────────────────────────────────────
    // distance_km / start_lat / end_lat no longer stored — derived from points.
    const sessionParams = [
      req.user.id,            // $1
      started_at,             // $2
      ended_at,               // $3
      duration_sec ?? null,   // $4
      avg_pace_sec ?? null,   // $5
      min_pace_sec ?? null,   // $6
      max_pace_sec ?? null,   // $7
      route_polyline ?? null, // $8
    ];

    let routeGeomClause = "NULL";
    if (location_points.length >= 2) {
      const wkt = "LINESTRING(" + location_points.map((p) => `${p.lng} ${p.lat}`).join(",") + ")";
      sessionParams.push(wkt); // $9
      routeGeomClause = "ST_GeomFromText($9, 4326)";
    }

    const sessionResult = await client.query(
      `
      INSERT INTO running.run_sessions
        (user_id, started_at, ended_at,
         duration_sec, avg_pace_sec, min_pace_sec, max_pace_sec,
         route_polyline, route_geom)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${routeGeomClause})
      RETURNING id
      `,
      sessionParams
    );
    const sessionId = sessionResult.rows[0].id;

    // ── 2. INSERT run_location_point (batch via unnest) ───────────────────────
    if (location_points.length > 0) {
      const locInsertResult = await client.query(
        `
        INSERT INTO running.run_location_point (
          session_id, recorded_at, elapsed_sec,
          lat, lng, geom,
          distance_km, current_pace_sec, elevation_m,
          temperature, humidity, feels_like, aqi,
          pm25, pm10, co, uv_index,
          wind_speed, wind_direction, cloud_cover_pct, rain_probability
        )
        SELECT
          $1, recorded_at, elapsed_sec,
          lat, lng, ST_SetSRID(ST_MakePoint(lng, lat), 4326),
          distance_km, current_pace_sec, elevation_m,
          temperature, humidity, feels_like, aqi,
          pm25, pm10, co, uv_index,
          wind_speed, wind_direction, cloud_cover_pct, rain_probability
        FROM unnest(
          $2::timestamptz[], $3::int[],
          $4::decimal[], $5::decimal[],
          $6::decimal[], $7::int[], $8::decimal[],
          $9::decimal[], $10::decimal[], $11::decimal[], $12::int[],
          $13::decimal[], $14::decimal[], $15::decimal[], $16::decimal[],
          $17::decimal[], $18::decimal[], $19::decimal[], $20::decimal[]
        ) AS t(
          recorded_at, elapsed_sec,
          lat, lng,
          distance_km, current_pace_sec, elevation_m,
          temperature, humidity, feels_like, aqi,
          pm25, pm10, co, uv_index,
          wind_speed, wind_direction, cloud_cover_pct, rain_probability
        )
        RETURNING id
        `,
        [
          sessionId,
          location_points.map((p) => p.recorded_at ?? null),
          location_points.map((p) => p.elapsed_sec ?? null),
          location_points.map((p) => p.lat ?? null),
          location_points.map((p) => p.lng ?? null),
          location_points.map((p) => p.distance_km ?? null),
          location_points.map((p) => p.current_pace_sec ?? null),
          location_points.map((p) => p.elevation_m ?? null),
          location_points.map((p) => p.temperature ?? null),
          location_points.map((p) => p.humidity ?? null),
          location_points.map((p) => p.feels_like ?? null),
          location_points.map((p) => p.aqi ?? null),
          location_points.map((p) => p.pm25 ?? null),
          location_points.map((p) => p.pm10 ?? null),
          location_points.map((p) => p.co ?? null),
          location_points.map((p) => p.uv_index ?? null),
          location_points.map((p) => p.wind_speed ?? null),
          location_points.map((p) => p.wind_direction ?? null),
          location_points.map((p) => p.cloud_cover_pct ?? null),
          location_points.map((p) => p.rain_probability ?? null),
        ]
      );

      // ── 3. INSERT run_watch_point (batch via unnest, 1-to-1) ─────────────────
      if (watch_points.length > 0) {
        const locationPointIds = locInsertResult.rows.map((r) => r.id);
        await client.query(
          `
          INSERT INTO running.run_watch_point (
            location_point_id, recorded_at, elapsed_sec,
            heart_rate_bpm, blood_oxygen_pct, hrv_ms, vo2max,
            cadence_spm, respiratory_rate_bpm, calories_burned_kcal
          )
          SELECT
            location_point_id, recorded_at, elapsed_sec,
            heart_rate_bpm, blood_oxygen_pct, hrv_ms, vo2max,
            cadence_spm, respiratory_rate_bpm, calories_burned_kcal
          FROM unnest(
            $1::bigint[], $2::timestamptz[], $3::int[],
            $4::int[], $5::decimal[], $6::decimal[], $7::decimal[],
            $8::int[], $9::decimal[], $10::decimal[]
          ) AS t(
            location_point_id, recorded_at, elapsed_sec,
            heart_rate_bpm, blood_oxygen_pct, hrv_ms, vo2max,
            cadence_spm, respiratory_rate_bpm, calories_burned_kcal
          )
          `,
          [
            locationPointIds,
            watch_points.map((w) => w.recorded_at ?? null),
            watch_points.map((w) => w.elapsed_sec ?? null),
            watch_points.map((w) => w.heart_rate_bpm ?? null),
            watch_points.map((w) => w.blood_oxygen_pct ?? null),
            watch_points.map((w) => w.hrv_ms ?? null),
            watch_points.map((w) => w.vo2max ?? null),
            watch_points.map((w) => w.cadence_spm ?? null),
            watch_points.map((w) => w.respiratory_rate_bpm ?? null),
            watch_points.map((w) => w.calories_burned_kcal ?? null),
          ]
        );
      }
      // run_environment_summary and run_smart_watch_summary are VIEWs —
      // they auto-aggregate from the rows just inserted above.
    }

    // ── 4. คำนวณ run_scores ──────────────────────────────────────────────────
    // calories จาก MET × weight × duration (ต่อ interval ระหว่าง points)
    const profileResult = await client.query(
      `SELECT weight_kg FROM identity.user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const weightKg = parseFloat(profileResult.rows[0]?.weight_kg);
    if (!weightKg) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "User weight is required. Please update your profile before submitting a run." });
    }

    function getMET(speedKmh) {
      if (speedKmh >= 12) return 12;
      if (speedKmh >= 10) return 10;
      if (speedKmh >= 8)  return 8;
      if (speedKmh >= 5)  return 6;
      if (speedKmh >= 3)  return 3;
      return 0;
    }

    let totalCalories = 0;
    for (let i = 1; i < location_points.length; i++) {
      const prev = location_points[i - 1];
      const curr = location_points[i];
      const intervalSec = (curr.elapsed_sec ?? 0) - (prev.elapsed_sec ?? 0);
      const distKm = (curr.distance_km ?? 0) - (prev.distance_km ?? 0);
      const speedKmh = intervalSec > 0 ? (distKm / intervalSec) * 3600 : 0;
      const met = getMET(speedKmh);
      totalCalories += met * weightKg * (intervalSec / 3600);
    }
    totalCalories = Math.round(totalCalories);

    const avgPm25 = location_points.length > 0
      ? location_points.reduce((s, p) => s + (p.pm25 ?? 0), 0) / location_points.length
      : 0;
    const avgHeatIndex = location_points.length > 0
      ? location_points.reduce((s, p) => s + (p.feels_like ?? p.temperature ?? 30), 0) / location_points.length
      : 30;

    const activityScore = Math.min(70, totalCalories * 0.2);
    const pmScore      = Math.max(0, 20 - avgPm25 * 0.4);
    const heatScore    = Math.max(0, 10 - (avgHeatIndex - 30) * 0.5);
    const overallScore = parseFloat((activityScore + pmScore + heatScore).toFixed(2));

    const grade =
      overallScore >= 90 ? "excellent" :
      overallScore >= 75 ? "good" :
      overallScore >= 60 ? "moderate" :
      overallScore >= 40 ? "poor" : "very_poor";

    await client.query(
      `
      INSERT INTO running.run_scores (session_id, overall_score, calories_burned_kcal, grade)
      VALUES ($1, $2, $3, $4)
      `,
      [sessionId, overallScore, totalCalories, grade]
    );

    await client.query("COMMIT");
    return res.status(201).json({ session_id: sessionId, overall_score: overallScore, grade });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ message: "Failed to submit run session" });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
app.listen(process.env.PORT || 3000, () => {
  console.log(`API running on http://localhost:${process.env.PORT || 3000}`);
});