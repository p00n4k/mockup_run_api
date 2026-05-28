// swagger.js — OpenAPI 3.0 spec for Flood Run API

const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Flood Run API",
    version: "3.0.0",
    description:
      "REST API สำหรับ Flood Running App — ติดตามข้อมูลการวิ่งพร้อม biometric จาก smartwatch และ environment data (AQI, UV, อุณหภูมิ)\n\n**Dev mode:** Auth middleware ถูก bypass — ทุก protected endpoint ใช้ `user_id = 1` อัตโนมัติ",
  },
  servers: [{ url: "http://localhost:3000", description: "Local dev server" }],
  tags: [
    { name: "Auth", description: "Authentication — login, refresh, logout" },
    { name: "Users", description: "User profile & health stats" },
    { name: "Run", description: "Running sessions, routes, scores" },
    { name: "Environment", description: "Ambient environment data (public)" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "ใส่ accessToken ที่ได้จาก /auth/login (ใน dev mode ไม่จำเป็น)",
      },
    },
    schemas: {
      // ── Generic ──────────────────────────────────────────────────────────
      Error: {
        type: "object",
        properties: {
          message: { type: "string", example: "Something went wrong" },
        },
      },
      // ── Auth ─────────────────────────────────────────────────────────────
      LoginRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", example: "pawin@example.com" },
          password: { type: "string", example: "anypassword" },
        },
      },
      TokenPair: {
        type: "object",
        properties: {
          accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
          refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
        },
      },
      // ── Users ────────────────────────────────────────────────────────────
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Pawin S." },
          email: { type: "string", format: "email", example: "pawin@example.com" },
          profile_image_url: { type: "string", nullable: true, example: null },
        },
      },
      UserProfile: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Pawin S." },
          email: { type: "string", format: "email" },
          birthday: { type: "string", format: "date", nullable: true, example: "1995-03-15" },
          gender: { type: "string", nullable: true, example: "male" },
          height_cm: { type: "number", nullable: true, example: 175 },
          weight_kg: { type: "number", nullable: true, example: 68 },
          step_length_cm: { type: "number", nullable: true, example: 75 },
          stride_length_cm: { type: "number", nullable: true, example: 150 },
          preferred_units: { type: "string", nullable: true, example: "metric" },
          resting_heart_rate_bpm: { type: "integer", nullable: true, example: 58 },
          max_heart_rate_bpm: { type: "integer", nullable: true, example: 185 },
          min_heart_rate_bpm: { type: "integer", nullable: true, example: 48 },
          avg_heart_rate_bpm: { type: "integer", nullable: true, example: 72 },
          vo2max: { type: "number", nullable: true, example: 52.3 },
          blood_oxygen_pct: { type: "number", nullable: true, example: 98.5 },
          respiratory_rate_bpm: { type: "number", nullable: true, example: 16.2 },
          basal_metabolic_rate_kcal: { type: "number", nullable: true, example: 1720 },
          active_energy_kcal_avg: { type: "number", nullable: true, example: 450 },
          sleep_duration_min_avg: { type: "number", nullable: true, example: 420 },
          sleep_score_avg: { type: "number", nullable: true, example: 78 },
          stats_period_start: { type: "string", format: "date-time", nullable: true },
          stats_period_end: { type: "string", format: "date-time", nullable: true },
          environment_scores: {
            type: "object",
            nullable: true,
            properties: {
              score_all_time: { type: "number", nullable: true, example: 72.45 },
              score_yearly: { type: "number", nullable: true, example: 74.1 },
              score_monthly: { type: "number", nullable: true, example: 76.3 },
              score_weekly: { type: "number", nullable: true, example: 78.0 },
            },
          },
        },
      },
      UpdateProfileRequest: {
        type: "object",
        properties: {
          name: { type: "string", example: "Pawin S." },
          profile_image_url: { type: "string", nullable: true, example: null },
          birthday: { type: "string", format: "date", example: "1995-03-15" },
          gender: { type: "string", example: "male" },
          height_cm: { type: "number", example: 175 },
          weight_kg: { type: "number", example: 68 },
          step_length_cm: { type: "number", example: 75 },
          stride_length_cm: { type: "number", example: 150 },
          preferred_units: { type: "string", example: "metric" },
        },
      },
      // ── Run sessions ─────────────────────────────────────────────────────
      SessionSummary: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          started_at: { type: "string", format: "date-time" },
          ended_at: { type: "string", format: "date-time" },
          distance_km: { type: "number", nullable: true, example: 5.12 },
          duration_sec: { type: "integer", example: 2400 },
          avg_pace_sec: { type: "integer", example: 390 },
          overall_score: { type: "number", nullable: true, example: 74.5 },
          grade: { type: "string", nullable: true, example: "good" },
        },
      },
      SessionDetail: {
        allOf: [
          { $ref: "#/components/schemas/SessionSummary" },
          {
            type: "object",
            properties: {
              min_pace_sec: { type: "integer", nullable: true, example: 340 },
              max_pace_sec: { type: "integer", nullable: true, example: 450 },
              start_lat: { type: "number", nullable: true, example: 13.7563 },
              start_lng: { type: "number", nullable: true, example: 100.5018 },
              end_lat: { type: "number", nullable: true, example: 13.7520 },
              end_lng: { type: "number", nullable: true, example: 100.5030 },
              heat_score: { type: "number", nullable: true, example: 7.0 },
              air_quality_score: { type: "number", nullable: true, example: 15.2 },
              uv_score: { type: "number", nullable: true, example: 8.5 },
              wind_score: { type: "number", nullable: true, example: 6.0 },
              humidity_score: { type: "number", nullable: true, example: 5.5 },
              cloud_score: { type: "number", nullable: true, example: 4.0 },
              calories_burned_kcal: { type: "integer", nullable: true, example: 420 },
            },
          },
        ],
      },
      // ── Route ────────────────────────────────────────────────────────────
      RoutePoint: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          elapsed_sec: { type: "integer", example: 60 },
          recorded_at: { type: "string", format: "date-time" },
          lat: { type: "number", example: 13.7563 },
          lng: { type: "number", example: 100.5018 },
          distance_km: { type: "number", nullable: true, example: 0.22 },
          current_pace_sec: { type: "integer", nullable: true, example: 385 },
          elevation_m: { type: "number", nullable: true, example: 12.5 },
        },
      },
      RouteResponse: {
        type: "object",
        properties: {
          session_id: { type: "integer", example: 1 },
          route_geojson: { type: "object", nullable: true },
          route_polyline: { type: "string", nullable: true, example: "aklcBcqxfR..." },
          route_geom: { type: "object", nullable: true },
          coordinates: {
            type: "array",
            items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
            example: [[13.7563, 100.5018], [13.755, 100.502]],
          },
          points: { type: "array", items: { $ref: "#/components/schemas/RoutePoint" } },
        },
      },
      // ── Environment ──────────────────────────────────────────────────────
      EnvSummary: {
        type: "object",
        description: "Aggregate min/avg/max for all environment fields over the session",
        properties: {
          avg_heat_index: { type: "number", nullable: true },
          min_heat_index: { type: "number", nullable: true },
          max_heat_index: { type: "number", nullable: true },
          avg_feels_like: { type: "number", nullable: true },
          min_feels_like: { type: "number", nullable: true },
          max_feels_like: { type: "number", nullable: true },
          avg_temperature: { type: "number", nullable: true },
          min_temperature: { type: "number", nullable: true },
          max_temperature: { type: "number", nullable: true },
          avg_humidity: { type: "number", nullable: true },
          min_humidity: { type: "number", nullable: true },
          max_humidity: { type: "number", nullable: true },
          avg_pm25: { type: "number", nullable: true },
          min_pm25: { type: "number", nullable: true },
          max_pm25: { type: "number", nullable: true },
          avg_pm10: { type: "number", nullable: true },
          min_pm10: { type: "number", nullable: true },
          max_pm10: { type: "number", nullable: true },
          avg_co: { type: "number", nullable: true },
          min_co: { type: "number", nullable: true },
          max_co: { type: "number", nullable: true },
          avg_aqi: { type: "integer", nullable: true },
          min_aqi: { type: "integer", nullable: true },
          max_aqi: { type: "integer", nullable: true },
          avg_uv_index: { type: "number", nullable: true },
          min_uv_index: { type: "number", nullable: true },
          max_uv_index: { type: "number", nullable: true },
          avg_wind_speed: { type: "number", nullable: true },
          min_wind_speed: { type: "number", nullable: true },
          max_wind_speed: { type: "number", nullable: true },
          avg_cloud_cover_pct: { type: "number", nullable: true },
          min_cloud_cover_pct: { type: "number", nullable: true },
          max_cloud_cover_pct: { type: "number", nullable: true },
        },
      },
      EnvPoint: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          elapsed_sec: { type: "integer", example: 60 },
          recorded_at: { type: "string", format: "date-time" },
          temperature: { type: "number", nullable: true, example: 33.1 },
          humidity: { type: "number", nullable: true, example: 70 },
          feels_like: { type: "number", nullable: true, example: 38.5 },
          aqi: { type: "integer", nullable: true, example: 72 },
          pm25: { type: "number", nullable: true, example: 24.5 },
          pm10: { type: "number", nullable: true, example: 38.0 },
          co: { type: "number", nullable: true, example: 0.42 },
          uv_index: { type: "number", nullable: true, example: 7.2 },
          wind_speed: { type: "number", nullable: true, example: 12.0 },
          wind_direction: { type: "number", nullable: true, example: 180 },
          cloud_cover_pct: { type: "number", nullable: true, example: 35 },
          rain_probability: { type: "number", nullable: true, example: 20 },
        },
      },
      EnvResponse: {
        type: "object",
        properties: {
          session_id: { type: "integer", example: 1 },
          summary: { $ref: "#/components/schemas/EnvSummary" },
          points: { type: "array", items: { $ref: "#/components/schemas/EnvPoint" } },
        },
      },
      // ── Biometric ────────────────────────────────────────────────────────
      BiometricSummary: {
        type: "object",
        properties: {
          avg_heart_rate_bpm: { type: "integer", nullable: true },
          min_heart_rate_bpm: { type: "integer", nullable: true },
          max_heart_rate_bpm: { type: "integer", nullable: true },
          avg_blood_oxygen_pct: { type: "number", nullable: true },
          min_blood_oxygen_pct: { type: "number", nullable: true },
          max_blood_oxygen_pct: { type: "number", nullable: true },
          avg_respiratory_rate_bpm: { type: "number", nullable: true },
          min_respiratory_rate_bpm: { type: "number", nullable: true },
          max_respiratory_rate_bpm: { type: "number", nullable: true },
          avg_hrv_ms: { type: "number", nullable: true },
          min_hrv_ms: { type: "number", nullable: true },
          max_hrv_ms: { type: "number", nullable: true },
          avg_cadence_spm: { type: "integer", nullable: true },
          min_cadence_spm: { type: "integer", nullable: true },
          max_cadence_spm: { type: "integer", nullable: true },
          calories_burned_kcal: { type: "integer", nullable: true },
          active_energy_kcal: { type: "integer", nullable: true },
          training_load: { type: "number", nullable: true },
          recovery_time_hr: { type: "number", nullable: true },
        },
      },
      BiometricPoint: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          elapsed_sec: { type: "integer", example: 60 },
          recorded_at: { type: "string", format: "date-time" },
          heart_rate_bpm: { type: "integer", nullable: true, example: 152 },
          blood_oxygen_pct: { type: "number", nullable: true, example: 98.0 },
          hrv_ms: { type: "number", nullable: true, example: 42.5 },
          vo2max: { type: "number", nullable: true, example: 48.2 },
          cadence_spm: { type: "integer", nullable: true, example: 162 },
          respiratory_rate_bpm: { type: "number", nullable: true, example: 22.5 },
          calories_burned_kcal: { type: "number", nullable: true, example: 85.3 },
        },
      },
      BiometricResponse: {
        type: "object",
        properties: {
          session_id: { type: "integer", example: 1 },
          summary: { $ref: "#/components/schemas/BiometricSummary" },
          points: { type: "array", items: { $ref: "#/components/schemas/BiometricPoint" } },
        },
      },
      // ── Combined point ───────────────────────────────────────────────────
      PointLocation: {
        type: "object",
        properties: {
          lat: { type: "number", nullable: true, example: 13.7563 },
          lng: { type: "number", nullable: true, example: 100.5018 },
          elevation_m: { type: "number", nullable: true, example: 12.5 },
          distance_km: { type: "number", nullable: true, example: 0.22 },
          current_pace_sec: { type: "integer", nullable: true, example: 385 },
        },
      },
      PointBiometric: {
        type: "object",
        nullable: true,
        properties: {
          heart_rate_bpm: { type: "integer", nullable: true, example: 155 },
          blood_oxygen_pct: { type: "number", nullable: true, example: 97.8 },
          hrv_ms: { type: "number", nullable: true, example: 40.1 },
          vo2max: { type: "number", nullable: true, example: 49.0 },
          cadence_spm: { type: "integer", nullable: true, example: 164 },
          respiratory_rate_bpm: { type: "number", nullable: true, example: 23.0 },
          calories_burned_kcal: { type: "number", nullable: true, example: 120.5 },
        },
      },
      CombinedPoint: {
        type: "object",
        properties: {
          session_id: { type: "integer", example: 1 },
          point_id: { type: "integer", example: 5 },
          elapsed_sec: { type: "integer", example: 300 },
          recorded_at: { type: "string", format: "date-time" },
          location: { $ref: "#/components/schemas/PointLocation" },
          environment: { $ref: "#/components/schemas/EnvPoint" },
          biometric: { $ref: "#/components/schemas/PointBiometric" },
        },
      },
      // ── Weekly / Monthly summaries ────────────────────────────────────────
      WeeklySummary: {
        type: "object",
        properties: {
          total_distance_km: { type: "number", example: 22.5 },
          total_sessions: { type: "integer", example: 4 },
          avg_pace_sec: { type: "integer", example: 395 },
        },
      },
      MonthlySummary: {
        type: "object",
        properties: {
          total_distance_km: { type: "number", example: 98.4 },
          total_sessions: { type: "integer", example: 18 },
          total_duration_sec: { type: "integer", example: 38700 },
          avg_pace_sec: { type: "integer", example: 390 },
          best_score: { type: "number", nullable: true, example: 88.5 },
          avg_score: { type: "number", nullable: true, example: 74.2 },
        },
      },
      // ── Nearby ───────────────────────────────────────────────────────────
      NearbySession: {
        type: "object",
        properties: {
          id: { type: "integer", example: 3 },
          started_at: { type: "string", format: "date-time" },
          distance_km: { type: "number", nullable: true, example: 6.3 },
          duration_sec: { type: "integer", example: 2700 },
          avg_pace_sec: { type: "integer", example: 405 },
          start_lat: { type: "number", nullable: true, example: 13.7563 },
          start_lng: { type: "number", nullable: true, example: 100.5018 },
          route_polyline: { type: "string", nullable: true },
          overall_score: { type: "number", nullable: true, example: 76.0 },
          grade: { type: "string", nullable: true, example: "good" },
          nearest_distance_km: { type: "number", example: 0.38 },
        },
      },
      // ── Current environment ──────────────────────────────────────────────
      CurrentEnv: {
        type: "object",
        properties: {
          lat: { type: "number", example: 13.7563 },
          lng: { type: "number", example: 100.5018 },
          temperature: { type: "number", example: 32.5 },
          feels_like: { type: "number", example: 38.2 },
          heat_index: { type: "number", example: 38.2 },
          humidity: { type: "integer", example: 72 },
          pm25: { type: "number", example: 24.5 },
          pm10: { type: "number", example: 38.0 },
          co: { type: "number", example: 0.42 },
          aqi: { type: "integer", example: 75 },
          uv_index: { type: "number", example: 7.2 },
          wind_speed: { type: "number", example: 12.0 },
          wind_direction: { type: "integer", example: 180 },
          cloud_cover_pct: { type: "integer", example: 35 },
          rain_probability: { type: "integer", example: 20 },
          recorded_at: { type: "string", format: "date-time" },
        },
      },
      // ── Submit ───────────────────────────────────────────────────────────
      LocationPointInput: {
        type: "object",
        required: ["recorded_at", "elapsed_sec", "lat", "lng"],
        properties: {
          recorded_at: { type: "string", format: "date-time" },
          elapsed_sec: { type: "integer", example: 60 },
          lat: { type: "number", example: 13.7563 },
          lng: { type: "number", example: 100.5018 },
          distance_km: { type: "number", nullable: true, example: 0.22 },
          current_pace_sec: { type: "integer", nullable: true, example: 385 },
          elevation_m: { type: "number", nullable: true, example: 12.5 },
          temperature: { type: "number", nullable: true, example: 33.0 },
          humidity: { type: "number", nullable: true, example: 70 },
          feels_like: { type: "number", nullable: true, example: 38.5 },
          aqi: { type: "integer", nullable: true, example: 72 },
          pm25: { type: "number", nullable: true, example: 24.5 },
          pm10: { type: "number", nullable: true, example: 38.0 },
          co: { type: "number", nullable: true, example: 0.42 },
          uv_index: { type: "number", nullable: true, example: 7.2 },
          wind_speed: { type: "number", nullable: true, example: 12.0 },
          wind_direction: { type: "number", nullable: true, example: 180 },
          cloud_cover_pct: { type: "number", nullable: true, example: 35 },
          rain_probability: { type: "number", nullable: true, example: 20 },
        },
      },
      WatchPointInput: {
        type: "object",
        required: ["recorded_at", "elapsed_sec"],
        properties: {
          recorded_at: { type: "string", format: "date-time" },
          elapsed_sec: { type: "integer", example: 60 },
          heart_rate_bpm: { type: "integer", nullable: true, example: 152 },
          blood_oxygen_pct: { type: "number", nullable: true, example: 98.0 },
          hrv_ms: { type: "number", nullable: true, example: 42.5 },
          vo2max: { type: "number", nullable: true, example: 48.2 },
          cadence_spm: { type: "integer", nullable: true, example: 162 },
          respiratory_rate_bpm: { type: "number", nullable: true, example: 22.5 },
          calories_burned_kcal: { type: "number", nullable: true, example: 85.3 },
        },
      },
      SubmitRequest: {
        type: "object",
        required: ["started_at", "ended_at", "location_points"],
        properties: {
          started_at: { type: "string", format: "date-time", example: "2025-05-20T06:00:00+07:00" },
          ended_at: { type: "string", format: "date-time", example: "2025-05-20T06:45:00+07:00" },
          duration_sec: { type: "integer", nullable: true, example: 2700 },
          avg_pace_sec: { type: "integer", nullable: true, example: 390 },
          min_pace_sec: { type: "integer", nullable: true, example: 340 },
          max_pace_sec: { type: "integer", nullable: true, example: 460 },
          route_polyline: {
            type: "string",
            nullable: true,
            description: "Encoded Google polyline string",
            example: "aklcBcqxfR...",
          },
          route_coordinates: {
            type: "array",
            nullable: true,
            description: "Array of [lng, lat] pairs used to build the PostGIS route geometry",
            items: {
              type: "array",
              items: { type: "number" },
              minItems: 2,
              maxItems: 2,
            },
            example: [[100.5018, 13.7563], [100.502, 13.755]],
          },
          location_points: {
            type: "array",
            items: { $ref: "#/components/schemas/LocationPointInput" },
            description: "Per-minute GPS + environment readings (required)",
          },
          watch_points: {
            type: "array",
            items: { $ref: "#/components/schemas/WatchPointInput" },
            description: "Per-minute smartwatch biometric readings (optional). Must have the same length as location_points if provided.",
          },
        },
      },
      SubmitResponse: {
        type: "object",
        properties: {
          session_id: { type: "integer", example: 11 },
          overall_score: { type: "number", example: 74.5 },
          grade: { type: "string", example: "good" },
          calories_burned_kcal: { type: "integer", example: 420 },
        },
      },
    },
  },
  // ── Paths ───────────────────────────────────────────────────────────────────
  paths: {
    // AUTH
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        description: "คืน accessToken + refreshToken เมื่อ email ถูกต้อง (password ไม่ตรวจสอบใน mock)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          200: {
            description: "Login successful",
            content: { "application/json": { schema: { $ref: "#/components/schemas/TokenPair" } } },
          },
          401: { description: "Invalid email or password", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "New access token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { accessToken: { type: "string" } },
                },
              },
            },
          },
          401: { description: "Invalid refresh token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Logged out successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string", example: "Logged out successfully" } },
                },
              },
            },
          },
        },
      },
    },
    // USERS
    "/api/v1/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get current user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Current user info", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          404: { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/users/me/profile": {
      get: {
        tags: ["Users"],
        summary: "Get full profile",
        description: "ดึงข้อมูล profile + health stats จาก smartwatch + average environment scores",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Full profile", content: { "application/json": { schema: { $ref: "#/components/schemas/UserProfile" } } } },
          404: { description: "Profile not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Update profile",
        description: "อัปเดต name, body stats (UPSERT) — ส่งเฉพาะ field ที่ต้องการเปลี่ยน",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateProfileRequest" } } },
        },
        responses: {
          200: { description: "Updated profile", content: { "application/json": { schema: { $ref: "#/components/schemas/UserProfile" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    // RUN - session history
    "/api/v1/run/session_history": {
      get: {
        tags: ["Run"],
        summary: "Session history",
        description: "ประวัติการวิ่ง ใช้ pagination ผ่าน page/limit หรือ offset/limit",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" }, description: "กรองจาก started_at >= startDate" },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" }, description: "กรองจาก started_at <= endDate" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "เลขหน้า (ใช้ร่วมกับ limit)" },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 }, description: "จำนวนผลลัพธ์ต่อหน้า" },
          { name: "offset", in: "query", schema: { type: "integer" }, description: "Override offset โดยตรง (แทน page)" },
        ],
        responses: {
          200: {
            description: "List of sessions",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/SessionSummary" } } } },
          },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    // RUN - session detail
    "/api/v1/run/session/{id}": {
      get: {
        tags: ["Run"],
        summary: "Session overview",
        description: "Stats + scores ของ session",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: { description: "Session detail", content: { "application/json": { schema: { $ref: "#/components/schemas/SessionDetail" } } } },
          404: { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/run/session/{id}/route": {
      get: {
        tags: ["Run"],
        summary: "Session route",
        description: "Route geometry + per-minute coordinate/pace/elevation",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: { description: "Route data", content: { "application/json": { schema: { $ref: "#/components/schemas/RouteResponse" } } } },
          404: { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/run/session/{id}/env": {
      get: {
        tags: ["Run"],
        summary: "Session environment",
        description: "Environment summary + per-minute env readings",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: { description: "Environment data", content: { "application/json": { schema: { $ref: "#/components/schemas/EnvResponse" } } } },
          404: { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/run/session/{id}/biometric": {
      get: {
        tags: ["Run"],
        summary: "Session biometric",
        description: "Smartwatch summary + per-minute biometric readings",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: { description: "Biometric data", content: { "application/json": { schema: { $ref: "#/components/schemas/BiometricResponse" } } } },
          404: { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/run/session/{id}/point/{point_id}": {
      get: {
        tags: ["Run"],
        summary: "Single point",
        description: "Location + environment + biometric รวมกันสำหรับจุดเดียว",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
          { name: "point_id", in: "path", required: true, schema: { type: "integer" }, example: 5 },
        ],
        responses: {
          200: { description: "Combined point data", content: { "application/json": { schema: { $ref: "#/components/schemas/CombinedPoint" } } } },
          404: { description: "Point not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/run/session/{id}/points": {
      get: {
        tags: ["Run"],
        summary: "Multiple points (batch)",
        description: "ดึงหลายจุดพร้อมกัน — location + env + biometric",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
          {
            name: "ids",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Comma-separated point IDs",
            example: "15,28,31",
          },
        ],
        responses: {
          200: {
            description: "Batch of combined points",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    session_id: { type: "integer", example: 1 },
                    requested_ids: { type: "array", items: { type: "integer" } },
                    count: { type: "integer", example: 3 },
                    points: { type: "array", items: { $ref: "#/components/schemas/CombinedPoint" } },
                  },
                },
              },
            },
          },
          400: { description: "ids param missing or invalid", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    // RUN - summaries
    "/api/v1/run/weekly": {
      get: {
        tags: ["Run"],
        summary: "Weekly summary",
        description: "สรุประยะทาง, จำนวน session, pace เฉลี่ย ใน 7 วันย้อนหลัง",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Weekly stats", content: { "application/json": { schema: { $ref: "#/components/schemas/WeeklySummary" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/run/monthly": {
      get: {
        tags: ["Run"],
        summary: "Monthly summary",
        description: "สรุปสถิติทั้งเดือน — ต้องระบุ year และ month",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "year", in: "query", required: true, schema: { type: "integer" }, example: 2025 },
          { name: "month", in: "query", required: true, schema: { type: "integer", minimum: 1, maximum: 12 }, example: 5 },
        ],
        responses: {
          200: { description: "Monthly stats", content: { "application/json": { schema: { $ref: "#/components/schemas/MonthlySummary" } } } },
          400: { description: "year and month are required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    // RUN - nearby
    "/api/v1/run/nearby": {
      get: {
        tags: ["Run"],
        summary: "Nearby sessions",
        description: "ค้นหา session ของ user ที่มี route อยู่ใกล้พิกัดที่กำหนด (ใช้ PostGIS ST_DWithin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "lat", in: "query", required: true, schema: { type: "number" }, example: 13.7563 },
          { name: "lng", in: "query", required: true, schema: { type: "number" }, example: 100.5018 },
          { name: "radius_km", in: "query", schema: { type: "number", default: 5 }, example: 2 },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 }, example: 5 },
        ],
        responses: {
          200: {
            description: "Nearby sessions sorted by distance",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/NearbySession" } } } },
          },
          400: { description: "lat and lng are required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    // ENVIRONMENT (public)
    "/api/v1/run/env": {
      get: {
        tags: ["Environment"],
        summary: "Current environment at coordinates",
        description: "สภาพแวดล้อม ณ พิกัดที่กำหนด (mock data, ไม่ต้อง auth)",
        parameters: [
          { name: "lat", in: "query", required: true, schema: { type: "number" }, example: 13.7563 },
          { name: "lng", in: "query", required: true, schema: { type: "number" }, example: 100.5018 },
        ],
        responses: {
          200: { description: "Current environment data", content: { "application/json": { schema: { $ref: "#/components/schemas/CurrentEnv" } } } },
          400: { description: "lat and lng are required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    // RUN - submit
    "/api/v1/run/submit": {
      post: {
        tags: ["Run"],
        summary: "Submit run session",
        description:
          "บันทึก session + location points + watch points ทั้งหมดในครั้งเดียว (1 transaction)\n\nขั้นตอน:\n1. INSERT run_sessions\n2. INSERT run_location_point (batch unnest)\n3. INSERT run_watch_point (optional, ต้อง length == location_points)\n4. INSERT run_environment_summary (auto-aggregate)\n5. INSERT run_smart_watch_summary (auto-aggregate ถ้ามี watch data)\n6. INSERT run_scores (MET-based calories + overall score)\n\n**ต้องการ weight_kg ใน profile ก่อนส่ง**",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SubmitRequest" } } },
        },
        responses: {
          201: { description: "Session submitted", content: { "application/json": { schema: { $ref: "#/components/schemas/SubmitResponse" } } } },
          400: {
            description: "Validation error (e.g. missing weight, mismatched watch_points length)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          500: { description: "Server error (transaction rolled back)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
};

module.exports = swaggerDocument;
