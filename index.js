// ── index.js — Flood Run API (v3, db_v3 schema) ─────────────────────────────
// Schema changes vs v2:
//   * run_environment_summary  : VIEW → TABLE
//   * run_smart_watch_summary  : VIEW → TABLE
//   * Both summary tables populated on POST /run/submit (single transaction)
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// บังคับให้ทุก connection ใช้ Asia/Bangkok — ป้องกัน timestamp shift
pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'Asia/Bangkok'");
});

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

// ── helpers ──────────────────────────────────────────────────────────────────

function avgOf(arr, key) {
  const vals = arr.map((x) => x[key]).filter((v) => v !== null && v !== undefined);
  return vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : null;
}
function minOf(arr, key) {
  const vals = arr.map((x) => x[key]).filter((v) => v !== null && v !== undefined).map(Number);
  return vals.length ? Math.min(...vals) : null;
}
function maxOf(arr, key) {
  const vals = arr.map((x) => x[key]).filter((v) => v !== null && v !== undefined).map(Number);
  return vals.length ? Math.max(...vals) : null;
}
function roundOrNull(v, dp = 2) {
  if (v === null || v === undefined) return null;
  return Number(Number(v).toFixed(dp));
}

function getMET(speedKmh) {
  if (speedKmh >= 12) return 12;
  if (speedKmh >= 10) return 10;
  if (speedKmh >= 8)  return 8;
  if (speedKmh >= 5)  return 6;
  if (speedKmh >= 3)  return 3;
  return 2; // เดินช้า/อยู่กับที่ — MET ของกิจกรรมเบาที่สุด
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

// ── USER ─────────────────────────────────────────────────────────────────────

app.get("/api/v1/users/me", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, profile_image_url
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
        u.id, u.name, u.email, u.profile_image_url,
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
        ROUND(AVG(res.overall_score)::numeric, 2) AS avg_score_all_time,
        ROUND(AVG(res.overall_score) FILTER (WHERE rs.started_at >= NOW() - INTERVAL '1 year')::numeric,  2) AS avg_score_yearly,
        ROUND(AVG(res.overall_score) FILTER (WHERE rs.started_at >= NOW() - INTERVAL '1 month')::numeric, 2) AS avg_score_monthly,
        ROUND(AVG(res.overall_score) FILTER (WHERE rs.started_at >= NOW() - INTERVAL '7 days')::numeric,  2) AS avg_score_weekly,
        COALESCE(SUM(res.overall_score), 0)::float AS total_overall_score
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

    if (name !== undefined || profile_image_url !== undefined) {
      await client.query(
        `UPDATE identity.users SET
           name = COALESCE($1, name),
           profile_image_url = COALESCE($2, profile_image_url)
         WHERE id = $3`,
        [name ?? null, profile_image_url ?? null, req.user.id]
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
      SELECT u.id, u.name, u.email, u.profile_image_url,
        up.birthday, up.gender, up.height_cm, up.weight_kg,
        up.step_length_cm, up.stride_length_cm, up.preferred_units
      FROM identity.users u
      LEFT JOIN identity.user_profiles up ON up.user_id = u.id
      WHERE u.id = $1 LIMIT 1
      `,
      [req.user.id]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ message: "Failed to update profile" });
  } finally {
    client.release();
  }
});

// ── RUN ──────────────────────────────────────────────────────────────────────

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
        rs.id, rs.started_at, rs.ended_at,
        lp_agg.distance_km,
        rs.duration_sec, rs.avg_pace_sec,
        res.overall_score, res.grade
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

app.get("/api/v1/run/session/:id", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        rs.id, rs.started_at, rs.ended_at,
        lp_agg.distance_km,
        rs.duration_sec, rs.avg_pace_sec, rs.min_pace_sec, rs.max_pace_sec,
        lp_first.lat AS start_lat, lp_first.lng AS start_lng,
        lp_last.lat  AS end_lat,   lp_last.lng  AS end_lng,
        res.overall_score, res.grade,
        res.heat_score, res.air_quality_score, res.uv_score,
        res.wind_score, res.humidity_score, res.cloud_score,
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
    console.log(`[session/${req.params.id}/route] route_polyline sent:`, session.route_polyline);
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

app.get("/api/v1/run/session/:id/env/summary", auth, async (req, res) => {
  try {
    const ownerCheck = await pool.query(
      `SELECT id FROM running.run_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const summaryResult = await pool.query(
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
    );

    return res.json({
      session_id: parseInt(req.params.id),
      summary: summaryResult.rows[0] ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get session environment summary" });
  }
});

app.get("/api/v1/run/session/:id/env/points", auth, async (req, res) => {
  try {
    const ownerCheck = await pool.query(
      `SELECT id FROM running.run_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const pointsResult = await pool.query(
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
    );

    return res.json({
      session_id: parseInt(req.params.id),
      points: pointsResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get session environment points" });
  }
});

app.get("/api/v1/run/session/:id/biometric/summary", auth, async (req, res) => {
  try {
    const ownerCheck = await pool.query(
      `SELECT id FROM running.run_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const summaryResult = await pool.query(
      `
      SELECT
        avg_heart_rate_bpm,       min_heart_rate_bpm,       max_heart_rate_bpm,
        avg_blood_oxygen_pct,     min_blood_oxygen_pct,     max_blood_oxygen_pct,
        avg_respiratory_rate_bpm, min_respiratory_rate_bpm, max_respiratory_rate_bpm,
        avg_hrv_ms,               min_hrv_ms,               max_hrv_ms,
        avg_cadence_spm,          min_cadence_spm,          max_cadence_spm,
        calories_burned_kcal, active_energy_kcal,
        training_load, recovery_time_hr
      FROM identity.run_smart_watch_summary
      WHERE session_id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    return res.json({
      session_id: parseInt(req.params.id),
      summary: summaryResult.rows[0] ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get session biometric summary" });
  }
});

app.get("/api/v1/run/session/:id/biometric/points", auth, async (req, res) => {
  try {
    const ownerCheck = await pool.query(
      `SELECT id FROM running.run_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const pointsResult = await pool.query(
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
    );

    return res.json({
      session_id: parseInt(req.params.id),
      points: pointsResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get session biometric points" });
  }
});

// helper: shape a joined location+watch row into the grouped point response
function shapePointRow(r) {
  if (!r) return null;
  const biometric =
    r.heart_rate_bpm === null &&
    r.blood_oxygen_pct === null &&
    r.hrv_ms === null &&
    r.vo2max === null &&
    r.cadence_spm === null &&
    r.respiratory_rate_bpm === null &&
    r.calories_burned_kcal === null
      ? null
      : {
          heart_rate_bpm:       r.heart_rate_bpm,
          blood_oxygen_pct:     r.blood_oxygen_pct     !== null ? parseFloat(r.blood_oxygen_pct)     : null,
          hrv_ms:               r.hrv_ms               !== null ? parseFloat(r.hrv_ms)               : null,
          vo2max:               r.vo2max               !== null ? parseFloat(r.vo2max)               : null,
          cadence_spm:          r.cadence_spm,
          respiratory_rate_bpm: r.respiratory_rate_bpm !== null ? parseFloat(r.respiratory_rate_bpm) : null,
          calories_burned_kcal: r.calories_burned_kcal !== null ? parseFloat(r.calories_burned_kcal) : null,
        };

  return {
    point_id: r.id,
    elapsed_sec: r.elapsed_sec,
    recorded_at: r.recorded_at,
    location: {
      lat:              r.lat              !== null ? parseFloat(r.lat)              : null,
      lng:              r.lng              !== null ? parseFloat(r.lng)              : null,
      elevation_m:      r.elevation_m      !== null ? parseFloat(r.elevation_m)      : null,
      distance_km:      r.distance_km      !== null ? parseFloat(r.distance_km)      : null,
      current_pace_sec: r.current_pace_sec,
    },
    environment: {
      temperature:      r.temperature      !== null ? parseFloat(r.temperature)      : null,
      feels_like:       r.feels_like       !== null ? parseFloat(r.feels_like)       : null,
      humidity:         r.humidity         !== null ? parseFloat(r.humidity)         : null,
      aqi:              r.aqi,
      pm25:             r.pm25             !== null ? parseFloat(r.pm25)             : null,
      pm10:             r.pm10             !== null ? parseFloat(r.pm10)             : null,
      co:               r.co               !== null ? parseFloat(r.co)               : null,
      uv_index:         r.uv_index         !== null ? parseFloat(r.uv_index)         : null,
      wind_speed:       r.wind_speed       !== null ? parseFloat(r.wind_speed)       : null,
      wind_direction:   r.wind_direction   !== null ? parseFloat(r.wind_direction)   : null,
      cloud_cover_pct:  r.cloud_cover_pct  !== null ? parseFloat(r.cloud_cover_pct)  : null,
      rain_probability: r.rain_probability !== null ? parseFloat(r.rain_probability) : null,
    },
    biometric,
  };
}

const POINT_SELECT_SQL = `
  SELECT
    lp.id, lp.elapsed_sec, lp.recorded_at,
    lp.lat, lp.lng, lp.elevation_m, lp.distance_km, lp.current_pace_sec,
    lp.temperature, lp.humidity, lp.feels_like,
    lp.aqi, lp.pm25, lp.pm10, lp.co, lp.uv_index,
    lp.wind_speed, lp.wind_direction, lp.cloud_cover_pct, lp.rain_probability,
    wp.heart_rate_bpm, wp.blood_oxygen_pct, wp.hrv_ms, wp.vo2max,
    wp.cadence_spm, wp.respiratory_rate_bpm, wp.calories_burned_kcal
  FROM running.run_location_point lp
  JOIN running.run_sessions s ON s.id = lp.session_id
  LEFT JOIN running.run_watch_point wp ON wp.location_point_id = lp.id
`;

// GET /api/v1/run/session/:id/point/:point_id — single point (location + env + biometric)
app.get("/api/v1/run/session/:id/point/:point_id", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `${POINT_SELECT_SQL}
       WHERE lp.id = $1 AND s.id = $2 AND s.user_id = $3
       LIMIT 1`,
      [req.params.point_id, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Point not found" });
    }
    return res.json({
      session_id: parseInt(req.params.id),
      ...shapePointRow(result.rows[0]),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get point" });
  }
});

// GET /api/v1/run/session/:id/points?ids=15,28 — multiple points in one call
app.get("/api/v1/run/session/:id/points", auth, async (req, res) => {
  try {
    const idsParam = (req.query.ids || "").toString().trim();
    if (!idsParam) {
      return res.status(400).json({ message: "Query param 'ids' is required (e.g. ?ids=15,28)" });
    }
    const ids = idsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      return res.status(400).json({ message: "No valid point ids in 'ids' param" });
    }

    const result = await pool.query(
      `${POINT_SELECT_SQL}
       WHERE lp.id = ANY($1::bigint[]) AND s.id = $2 AND s.user_id = $3
       ORDER BY lp.elapsed_sec`,
      [ids, req.params.id, req.user.id]
    );

    return res.json({
      session_id: parseInt(req.params.id),
      requested_ids: ids,
      count: result.rows.length,
      points: result.rows.map(shapePointRow),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to get points" });
  }
});

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

app.get("/api/v1/run/nearby", auth, async (req, res) => {
  try {
    const { lat, lng, radius_km = 5, limit = 10 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const result = await pool.query(
      `
      SELECT
        rs.id, rs.started_at,
        lp_agg.distance_km, rs.duration_sec, rs.avg_pace_sec,
        lp_first.lat AS start_lat, lp_first.lng AS start_lng,
        rs.route_polyline,
        res.overall_score, res.grade,
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
    console.log("[run/nearby] route_polylines sent:",
      result.rows.map((r) => ({ id: r.id, route_polyline: r.route_polyline })));
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to find nearby sessions" });
  }
});

app.get("/api/v1/run/env", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ message: "lat and lng are required" });
  }
  // mock readings — สุ่มใหม่ทุกครั้งในช่วงที่สมเหตุผลของกรุงเทพฯ
  const rnd = (min, max, decimals = 1) =>
    parseFloat((min + Math.random() * (max - min)).toFixed(decimals));
  const rndInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

  const temperature = rnd(29, 36);
  const humidity = rnd(55, 85);
  const feelsLike = parseFloat((temperature + humidity / 20).toFixed(1));

  return res.json({
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    temperature, feels_like: feelsLike, heat_index: feelsLike,
    humidity,
    pm25: rnd(10, 60),
    pm10: rnd(20, 90),
    co: rnd(0.2, 0.9, 2),
    aqi: rndInt(40, 130),
    uv_index: rnd(2, 11),
    wind_speed: rnd(2, 20),
    wind_direction: rndInt(0, 359),
    cloud_cover_pct: rndInt(0, 100),
    rain_probability: rndInt(0, 80),
    recorded_at: new Date().toISOString(),
  });
});

/**
 * POST /api/v1/run/submit
 *
 * Transaction order:
 *   1. INSERT run_sessions
 *   2. INSERT run_location_point (batch)
 *   3. INSERT run_watch_point    (batch, optional)
 *   4. INSERT run_environment_summary  (computed from location_points)
 *   5. INSERT run_smart_watch_summary  (computed from watch_points, optional)
 *   6. INSERT run_scores               (MET-based calories + overall score)
 */
app.post("/api/v1/run/submit", auth, async (req, res) => {
  const {
    started_at, ended_at,
    duration_sec, avg_pace_sec, min_pace_sec, max_pace_sec,
    route_polyline,
    route_coordinates,   // [[lng, lat], ...] — สร้าง route_geom จากตัวนี้ตรง ๆ
    location_points = [],
    watch_points = [],
  } = req.body;

  console.log("[submit] route_polyline received:", route_polyline);
  console.log("[submit] route_coordinates length:", route_coordinates?.length ?? 0);

  const hasWatchData = watch_points.length > 0;
  if (hasWatchData && watch_points.length !== location_points.length) {
    return res.status(400).json({
      message: "watch_points must have the same length as location_points",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. require weight before doing anything else
    const profileResult = await client.query(
      `SELECT weight_kg FROM identity.user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const weightKg = parseFloat(profileResult.rows[0]?.weight_kg);
    if (!weightKg) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "User weight is required. Please update your profile before submitting a run.",
      });
    }

    // 2. INSERT run_sessions
    const sessionParams = [
      req.user.id, started_at, ended_at,
      duration_sec ?? null, avg_pace_sec ?? null,
      min_pace_sec ?? null, max_pace_sec ?? null,
      route_polyline ?? null,
    ];

    // ใช้ route_coordinates จาก client ก่อน — fallback เป็น location_points ถ้าไม่ส่งมา
    let routeGeomClause = "NULL";
    const geomSource = Array.isArray(route_coordinates) && route_coordinates.length >= 2
      ? route_coordinates.map(([lng, lat]) => `${lng} ${lat}`)
      : (location_points.length >= 2
          ? location_points.map((p) => `${p.lng} ${p.lat}`)
          : null);

    if (geomSource) {
      const wkt = "LINESTRING(" + geomSource.join(",") + ")";
      sessionParams.push(wkt);
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

    // 3. INSERT run_location_point
    let locationPointIds = [];
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
      locationPointIds = locInsertResult.rows.map((r) => r.id);

      // 4. INSERT run_watch_point (optional)
      if (hasWatchData) {
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

      // 5. INSERT run_environment_summary  (computed from location_points)
      await client.query(
        `
        INSERT INTO running.run_environment_summary (
          session_id,
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
        ) VALUES (
          $1,
          $2,  $3,  $4,
          $5,  $6,  $7,
          $8,  $9,  $10,
          $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22,
          $23, $24, $25,
          $26, $27, $28,
          $29, $30, $31,
          $32, $33, $34
        )
        `,
        [
          sessionId,
          roundOrNull(avgOf(location_points, "feels_like"),  2), roundOrNull(minOf(location_points, "feels_like"),  2), roundOrNull(maxOf(location_points, "feels_like"),  2),
          roundOrNull(avgOf(location_points, "feels_like"),  2), roundOrNull(minOf(location_points, "feels_like"),  2), roundOrNull(maxOf(location_points, "feels_like"),  2),
          roundOrNull(avgOf(location_points, "temperature"), 2), roundOrNull(minOf(location_points, "temperature"), 2), roundOrNull(maxOf(location_points, "temperature"), 2),
          roundOrNull(avgOf(location_points, "humidity"),    2), roundOrNull(minOf(location_points, "humidity"),    2), roundOrNull(maxOf(location_points, "humidity"),    2),
          roundOrNull(avgOf(location_points, "pm25"),        2), roundOrNull(minOf(location_points, "pm25"),        2), roundOrNull(maxOf(location_points, "pm25"),        2),
          roundOrNull(avgOf(location_points, "pm10"),        2), roundOrNull(minOf(location_points, "pm10"),        2), roundOrNull(maxOf(location_points, "pm10"),        2),
          roundOrNull(avgOf(location_points, "co"),          3), roundOrNull(minOf(location_points, "co"),          3), roundOrNull(maxOf(location_points, "co"),          3),
          avgOf(location_points, "aqi") !== null ? Math.round(avgOf(location_points, "aqi")) : null, minOf(location_points, "aqi"), maxOf(location_points, "aqi"),
          roundOrNull(avgOf(location_points, "uv_index"),    2), roundOrNull(minOf(location_points, "uv_index"),    2), roundOrNull(maxOf(location_points, "uv_index"),    2),
          roundOrNull(avgOf(location_points, "wind_speed"),  2), roundOrNull(minOf(location_points, "wind_speed"),  2), roundOrNull(maxOf(location_points, "wind_speed"),  2),
          roundOrNull(avgOf(location_points, "cloud_cover_pct"), 2), roundOrNull(minOf(location_points, "cloud_cover_pct"), 2), roundOrNull(maxOf(location_points, "cloud_cover_pct"), 2),
        ]
      );

      // 6. INSERT run_smart_watch_summary  (computed from watch_points, optional)
      if (hasWatchData) {
        const avgHr   = avgOf(watch_points, "heart_rate_bpm");
        const avgCad  = avgOf(watch_points, "cadence_spm");
        const maxCal  = maxOf(watch_points, "calories_burned_kcal");

        await client.query(
          `
          INSERT INTO identity.run_smart_watch_summary (
            session_id,
            avg_heart_rate_bpm,       min_heart_rate_bpm,       max_heart_rate_bpm,
            avg_blood_oxygen_pct,     min_blood_oxygen_pct,     max_blood_oxygen_pct,
            avg_respiratory_rate_bpm, min_respiratory_rate_bpm, max_respiratory_rate_bpm,
            avg_hrv_ms,               min_hrv_ms,               max_hrv_ms,
            avg_cadence_spm,          min_cadence_spm,          max_cadence_spm,
            calories_burned_kcal, active_energy_kcal,
            training_load, recovery_time_hr
          ) VALUES (
            $1,
            $2,  $3,  $4,
            $5,  $6,  $7,
            $8,  $9,  $10,
            $11, $12, $13,
            $14, $15, $16,
            $17, $18, $19, $20
          )
          `,
          [
            sessionId,
            avgHr !== null ? Math.round(avgHr) : null, minOf(watch_points, "heart_rate_bpm"), maxOf(watch_points, "heart_rate_bpm"),
            roundOrNull(avgOf(watch_points, "blood_oxygen_pct"),     2), roundOrNull(minOf(watch_points, "blood_oxygen_pct"),     2), roundOrNull(maxOf(watch_points, "blood_oxygen_pct"),     2),
            roundOrNull(avgOf(watch_points, "respiratory_rate_bpm"), 2), roundOrNull(minOf(watch_points, "respiratory_rate_bpm"), 2), roundOrNull(maxOf(watch_points, "respiratory_rate_bpm"), 2),
            roundOrNull(avgOf(watch_points, "hrv_ms"),               2), roundOrNull(minOf(watch_points, "hrv_ms"),               2), roundOrNull(maxOf(watch_points, "hrv_ms"),               2),
            avgCad !== null ? Math.round(avgCad) : null, minOf(watch_points, "cadence_spm"), maxOf(watch_points, "cadence_spm"),
            maxCal !== null ? Math.round(maxCal) : null,
            maxCal !== null ? Math.round(maxCal) : null,
            null, null,
          ]
        );
      }
    }

    // 7. INSERT run_scores  (MET-based calories + overall score)
    let totalCalories = 0;
    for (let i = 1; i < location_points.length; i++) {
      const prev = location_points[i - 1];
      const curr = location_points[i];
      const intervalSec = (curr.elapsed_sec ?? 0) - (prev.elapsed_sec ?? 0);
      const distKm = (curr.distance_km ?? 0) - (prev.distance_km ?? 0);
      const speedKmh = intervalSec > 0 ? (distKm / intervalSec) * 3600 : 0;
      totalCalories += getMET(speedKmh) * weightKg * (intervalSec / 3600);
    }
    totalCalories = Math.round(totalCalories);

    const avgPm25 = avgOf(location_points, "pm25") ?? 0;
    const avgHeatIndex = avgOf(location_points, "feels_like")
      ?? avgOf(location_points, "temperature")
      ?? 30;

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
    return res.status(201).json({
      session_id: sessionId,
      overall_score: overallScore,
      grade,
      calories_burned_kcal: totalCalories,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ message: "Failed to submit run session" });
  } finally {
    client.release();
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`API v3 running on http://localhost:${process.env.PORT || 3000}`);
});
