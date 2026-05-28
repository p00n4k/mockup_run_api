# Flood Run API — Documentation v3

Base URL: `http://localhost:3000`

> **Dev mode:** Auth middleware is bypassed. All protected endpoints use `user_id = 1` automatically. No real token required.

## Schema notes (v3)

| Change | Detail |
|--------|--------|
| `run_environment_summary` | VIEW → **TABLE** — populated atomically on `POST /run/submit` |
| `run_smart_watch_summary` | VIEW → **TABLE** in `identity` schema — populated atomically on `POST /run/submit` |
| `run_sessions.started_at` / `ended_at` | `timestamp` → `timestamptz` (Asia/Bangkok) |
| `run_location_point.recorded_at`, `run_watch_point.recorded_at` | `timestamp` → `timestamptz` |
| `run_sessions.route_polyline` | `varchar(2000)` → `text` (รองรับ route ยาว เช่น marathon) |
| `run_scores` | INSERT อัตโนมัติตอน submit — คำนวณ MET-based calories + overall_score |
| `POST /users/me/profile` | `weight_kg` กลายเป็น **required** ก่อนจะ submit run ได้ |
| `POST /run/submit` | เพิ่ม `route_coordinates` (optional) — array `[[lng, lat], ...]` ใช้สร้าง `route_geom` ตรงๆ |

### Score formula

```
ActivityScore = min(70, calories × 0.2)
PMScore       = max(0, 20 - avg_pm25 × 0.4)
HeatScore     = max(0, 10 - (avg_heat_index - 30) × 0.5)
overall_score = ActivityScore + PMScore + HeatScore   (max 100)
```

| overall_score | grade |
|---|---|
| ≥ 90 | excellent |
| ≥ 75 | good |
| ≥ 60 | moderate |
| ≥ 40 | poor |
| < 40 | very_poor |

### MET table (used for calorie calculation)

| Speed (km/h) | MET |
|---|---|
| ≥ 12 | 12 |
| ≥ 10 | 10 |
| ≥ 8  | 8 |
| ≥ 5  | 6 |
| ≥ 3  | 3 |
| < 3  | 2 |

---

## Endpoint index

| # | Method | Auth | Path | Description |
|---|--------|------|------|-------------|
| 1 | POST | Public | `/api/v1/auth/login` | Login, returns tokens |
| 2 | POST | Public | `/api/v1/auth/refresh` | Refresh access token |
| 3 | POST | JWT | `/api/v1/auth/logout` | Logout |
| 4 | GET | JWT | `/api/v1/users/me` | Current user info |
| 5 | GET | JWT | `/api/v1/users/me/profile` | Full profile + health stats |
| 6 | POST | JWT | `/api/v1/users/me/profile` | Update profile |
| 7 | GET | JWT | `/api/v1/run/session_history` | Session list (paginated) |
| 8 | GET | JWT | `/api/v1/run/session/:id` | Session overview + scores |
| 9 | GET | JWT | `/api/v1/run/session/:id/route` | Route geometry + per-min points |
| 10a | GET | JWT | `/api/v1/run/session/:id/env/summary` | Env summary only |
| 10b | GET | JWT | `/api/v1/run/session/:id/env/points` | Env per-min readings only |
| 11a | GET | JWT | `/api/v1/run/session/:id/biometric/summary` | Biometric summary only |
| 11b | GET | JWT | `/api/v1/run/session/:id/biometric/points` | Biometric per-min readings only |
| 12 | GET | JWT | `/api/v1/run/session/:id/point/:point_id` | Single point — location + env + biometric |
| 13 | GET | JWT | `/api/v1/run/session/:id/points?ids=…` | Multiple points by id list |
| 14 | GET | JWT | `/api/v1/run/weekly` | 7-day summary |
| 15 | GET | JWT | `/api/v1/run/monthly` | Monthly summary |
| 16 | GET | JWT | `/api/v1/run/nearby` | Nearby sessions (PostGIS) |
| 17 | GET | Public | `/api/v1/run/env` | Current env at a location (mock) |
| 18 | POST | JWT | `/api/v1/run/submit` | Submit run session + points batch |

---

## AUTH

### 1. POST /api/v1/auth/login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "pawin@example.com", "password": "anypassword"}'
```

**Response**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2. POST /api/v1/auth/refresh

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your_refresh_token>"}'
```

**Response**
```json
{ "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

---

### 3. POST /api/v1/auth/logout

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{ "message": "Logged out successfully" }
```

---

## USER

### 4. GET /api/v1/users/me

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "id": 1,
  "name": "Pawin Khamlaksana",
  "email": "pawin@example.com",
  "profile_image_url": null
}
```

---

### 5. GET /api/v1/users/me/profile

```bash
curl http://localhost:3000/api/v1/users/me/profile \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "id": 1,
  "name": "Pawin Khamlaksana",
  "email": "pawin@example.com",
  "profile_image_url": "https://i.pravatar.cc/300?u=1",
  "birthday": "2004-08-15",
  "gender": "male",
  "height_cm": "175.00",
  "weight_kg": "68.50",
  "step_length_cm": "72.00",
  "stride_length_cm": "144.00",
  "preferred_units": "metric",
  "resting_heart_rate_bpm": 58,
  "max_heart_rate_bpm": 190,
  "min_heart_rate_bpm": 48,
  "avg_heart_rate_bpm": 132,
  "vo2max": "48.50",
  "blood_oxygen_pct": "98.00",
  "respiratory_rate_bpm": "15.20",
  "basal_metabolic_rate_kcal": 1650,
  "active_energy_kcal_avg": 520,
  "sleep_duration_min_avg": 430,
  "sleep_score_avg": "82.50",
  "stats_period_start": "2026-04-25T00:00:00.000Z",
  "stats_period_end": "2026-05-25T00:00:00.000Z",
  "environment_scores": {
    "avg_score_all_time": "78.52",
    "avg_score_yearly":   "78.52",
    "avg_score_monthly":  "82.30",
    "avg_score_weekly":   "80.40",
    "total_overall_score": 392.5
  }
}
```

> `avg_score_*` = ค่าเฉลี่ย (AVG) ของ `overall_score` กรองตามช่วงเวลา — `total_overall_score` = ผลรวม (SUM) ทุก session

---

### 6. POST /api/v1/users/me/profile

Fields not sent are kept as-is (COALESCE upsert).

```bash
curl -X POST http://localhost:3000/api/v1/users/me/profile \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pawin K.",
    "profile_image_url": "https://i.pravatar.cc/300?u=1",
    "birthday": "2004-08-15",
    "gender": "male",
    "height_cm": 175.0,
    "weight_kg": 70.0,
    "step_length_cm": 72.0,
    "stride_length_cm": 144.0,
    "preferred_units": "metric"
  }'
```

**Response**
```json
{
  "id": 1,
  "name": "Pawin K.",
  "email": "pawin@example.com",
  "profile_image_url": "https://i.pravatar.cc/300?u=1",
  "birthday": "2004-08-15",
  "gender": "male",
  "height_cm": "175.00",
  "weight_kg": "70.00",
  "step_length_cm": "72.00",
  "stride_length_cm": "144.00",
  "preferred_units": "metric"
}
```

---

## RUNNING

### 7. GET /api/v1/run/session_history

ประวัติการวิ่ง พร้อม `overall_score` และ `grade` สำหรับ calendar  
`distance_km` ถูก derive จาก `MAX(run_location_point.distance_km)` ผ่าน lateral join

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `startDate` | ISO date | No | วันเริ่มต้น |
| `endDate` | ISO date | No | วันสิ้นสุด |
| `limit` | number | No | รายการต่อหน้า (default: 10) |
| `offset` | number | No | ข้าม N รายการ (default: 0) |
| `page` | number | No | แทน offset ได้ — `offset = (page-1) * limit` |

```bash
curl "http://localhost:3000/api/v1/run/session_history?limit=50&offset=0" \
  -H "Authorization: Bearer <your_access_token>"

curl "http://localhost:3000/api/v1/run/session_history?startDate=2026-05-01&endDate=2026-05-31&limit=10&offset=0" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
[
  {
    "id": 1,
    "started_at": "2026-05-24T06:00:00.000Z",
    "ended_at": "2026-05-24T06:35:00.000Z",
    "distance_km": "5.20",
    "duration_sec": 2100,
    "avg_pace_sec": 403,
    "overall_score": "78.50",
    "grade": "good"
  },
  {
    "id": 2,
    "started_at": "2026-05-22T06:15:00.000Z",
    "ended_at": "2026-05-22T07:07:00.000Z",
    "distance_km": "8.10",
    "duration_sec": 3120,
    "avg_pace_sec": 385,
    "overall_score": "82.30",
    "grade": "good"
  }
]
```

---

### 8. GET /api/v1/run/session/:id

Session overview — stats + คะแนนสิ่งแวดล้อมแยก category  
`distance_km`, `start_lat/lng`, `end_lat/lng` derive จาก `run_location_point`

```bash
curl "http://localhost:3000/api/v1/run/session/1" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "id": 1,
  "started_at": "2026-05-24T06:00:00.000Z",
  "ended_at": "2026-05-24T06:35:00.000Z",
  "distance_km": "5.20",
  "duration_sec": 2100,
  "avg_pace_sec": 403,
  "min_pace_sec": 358,
  "max_pace_sec": 450,
  "start_lat": "13.7283000",
  "start_lng": "100.5418000",
  "end_lat": "13.7310000",
  "end_lng": "100.5460000",
  "overall_score": "78.50",
  "grade": "good",
  "heat_score": "72.00",
  "air_quality_score": "80.00",
  "uv_score": "75.00",
  "wind_score": "85.00",
  "humidity_score": "78.00",
  "cloud_score": "82.00",
  "calories_burned_kcal": 371
}
```

---

### 9. GET /api/v1/run/session/:id/route

Route geometry + per-minute coordinate/pace/elevation points

```bash
curl "http://localhost:3000/api/v1/run/session/1/route" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "session_id": 1,
  "route_geojson": null,
  "route_polyline": null,
  "route_geom": {
    "type": "LineString",
    "coordinates": [[100.5418, 13.7283], [100.5430, 13.7293], [100.5460, 13.7310]]
  },
  "coordinates": [
    [13.7283, 100.5418],
    [13.7292, 100.5432],
    [13.7301, 100.5446],
    [13.7310, 100.5460]
  ],
  "points": [
    {
      "id": 1,
      "elapsed_sec": 0,
      "recorded_at": "2026-05-24T06:00:00.000Z",
      "lat": 13.7283,
      "lng": 100.5418,
      "distance_km": 0.0,
      "current_pace_sec": null,
      "elevation_m": 1.5
    },
    {
      "id": 2,
      "elapsed_sec": 700,
      "recorded_at": "2026-05-24T06:11:40.000Z",
      "lat": 13.7292,
      "lng": 100.5432,
      "distance_km": 1.73,
      "current_pace_sec": 405,
      "elevation_m": 1.5
    }
  ]
}
```

> - `route_geom.coordinates` → lng/lat order (GeoJSON standard) — use with `google.maps.Polyline`
> - `coordinates` → lat/lng order — use with Flutter Maps / Leaflet
> - `points` → use to plot elevation profile or pace-over-distance graph

---

### 10a. GET /api/v1/run/session/:id/env/summary

Env summary เท่านั้น (pre-computed table, populated on submit)

```bash
curl "http://localhost:3000/api/v1/run/session/1/env/summary" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "session_id": 1,
  "summary": {
    "avg_heat_index": "37.50",  "min_heat_index": "37.50",  "max_heat_index": "37.50",
    "avg_feels_like": "37.50",  "min_feels_like": "37.50",  "max_feels_like": "37.50",
    "avg_temperature": "31.20", "min_temperature": "31.20", "max_temperature": "31.20",
    "avg_humidity": "74.00",    "min_humidity": "74.00",    "max_humidity": "74.00",
    "avg_pm25": "24.50",        "min_pm25": "24.50",        "max_pm25": "24.50",
    "avg_pm10": "38.00",        "min_pm10": "38.00",        "max_pm10": "38.00",
    "avg_co": "0.420",          "min_co": "0.420",          "max_co": "0.420",
    "avg_aqi": 75,              "min_aqi": 75,              "max_aqi": 75,
    "avg_uv_index": "6.80",     "min_uv_index": "6.80",     "max_uv_index": "6.80",
    "avg_wind_speed": "12.00",  "min_wind_speed": "12.00",  "max_wind_speed": "12.00",
    "avg_cloud_cover_pct": null,"min_cloud_cover_pct": null,"max_cloud_cover_pct": null
  }
}
```

---

### 10b. GET /api/v1/run/session/:id/env/points

Per-minute env readings ทั้งหมด  
Points include `wind_direction`, `cloud_cover_pct`, `rain_probability`

```bash
curl "http://localhost:3000/api/v1/run/session/1/env/points" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "session_id": 1,
  "points": [
    {
      "id": 1,
      "elapsed_sec": 0,
      "recorded_at": "2026-05-24T06:00:00.000Z",
      "temperature": "31.20",
      "humidity": "74.00",
      "feels_like": "37.50",
      "aqi": 75,
      "pm25": "24.50",
      "pm10": "38.00",
      "co": "0.420",
      "uv_index": "6.80",
      "wind_speed": "12.00",
      "wind_direction": null,
      "cloud_cover_pct": null,
      "rain_probability": null
    }
  ]
}
```

> `points` ordered by `elapsed_sec` — plot AQI/temperature/UV over run time

---

### 11a. GET /api/v1/run/session/:id/biometric/summary

Biometric summary เท่านั้น (pre-computed table, populated on submit)

```bash
curl "http://localhost:3000/api/v1/run/session/1/biometric/summary" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "session_id": 1,
  "summary": {
    "avg_heart_rate_bpm": 158,    "min_heart_rate_bpm": 132,    "max_heart_rate_bpm": 178,
    "avg_blood_oxygen_pct": "98.20","min_blood_oxygen_pct": "96.00","max_blood_oxygen_pct": "99.50",
    "avg_respiratory_rate_bpm": "26.50","min_respiratory_rate_bpm": "22.00","max_respiratory_rate_bpm": "32.00",
    "avg_hrv_ms": "28.50",        "min_hrv_ms": "14.00",        "max_hrv_ms": "52.00",
    "avg_cadence_spm": 168,       "min_cadence_spm": 155,       "max_cadence_spm": 178,
    "calories_burned_kcal": 371,
    "active_energy_kcal": 371,
    "training_load": null,
    "recovery_time_hr": null
  }
}
```

> `summary.calories_burned_kcal` comes from `MAX(watch_point.calories_burned_kcal)` (smartwatch)  
> `run_scores.calories_burned_kcal` is independent — calculated server-side from MET × weight × duration  
> `training_load` and `recovery_time_hr` are `null` (not computed)

---

### 11b. GET /api/v1/run/session/:id/biometric/points

Per-minute smartwatch readings ทั้งหมด

```bash
curl "http://localhost:3000/api/v1/run/session/1/biometric/points" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "session_id": 1,
  "points": [
    {
      "id": 1,
      "elapsed_sec": 0,
      "recorded_at": "2026-05-24T06:00:00.000Z",
      "heart_rate_bpm": 142,
      "blood_oxygen_pct": "99.00",
      "hrv_ms": "52.00",
      "vo2max": "44.20",
      "cadence_spm": 155,
      "respiratory_rate_bpm": "22.00",
      "calories_burned_kcal": "0.00"
    },
    {
      "id": 2,
      "elapsed_sec": 700,
      "recorded_at": "2026-05-24T06:11:40.000Z",
      "heart_rate_bpm": 165,
      "blood_oxygen_pct": "97.50",
      "hrv_ms": "22.00",
      "vo2max": "50.10",
      "cadence_spm": 171,
      "respiratory_rate_bpm": "29.00",
      "calories_burned_kcal": "248.50"
    }
  ]
}
```

> `calories_burned_kcal` in points is **cumulative** — the last value equals the session total

---

### 12. GET /api/v1/run/session/:id/point/:point_id

ดึงข้อมูลของจุดเดียว (per-minute) — รวม location + environment + biometric ใน response เดียว

`:point_id` คือ `id` ของ `run_location_point` (มาจาก field `id` ใน response ของ `/route`, `/env/points`, `/biometric/points`)

```bash
curl http://localhost:3000/api/v1/run/session/1/point/15 \
  -H "Authorization: Bearer <your_access_token>"
```

**Response 200** (มี smartwatch)
```json
{
  "session_id": 1,
  "point_id": 15,
  "elapsed_sec": 180,
  "recorded_at": "2026-05-26T06:03:00+07:00",
  "location": {
    "lat": 13.7308,
    "lng": 100.5418,
    "elevation_m": 12.5,
    "distance_km": 0.521,
    "current_pace_sec": 345
  },
  "environment": {
    "temperature": 32.4,
    "feels_like": 38.1,
    "humidity": 68.0,
    "aqi": 87,
    "pm25": 42.3,
    "pm10": 65.1,
    "co": 0.412,
    "uv_index": 7.2,
    "wind_speed": 2.1,
    "wind_direction": 180.0,
    "cloud_cover_pct": 35.0,
    "rain_probability": 10.0
  },
  "biometric": {
    "heart_rate_bpm": 152,
    "blood_oxygen_pct": 97.5,
    "hrv_ms": 45.2,
    "vo2max": 48.5,
    "cadence_spm": 168,
    "respiratory_rate_bpm": 28.5,
    "calories_burned_kcal": 42.50
  }
}
```

> ถ้า session ไม่มี smartwatch data จุดนั้น → `"biometric": null`

**Response 404** — point ไม่อยู่ / ไม่ใช่ของ session นี้ / ไม่ใช่ของ user
```json
{ "message": "Point not found" }
```

---

### 13. GET /api/v1/run/session/:id/points?ids=15,28

ดึงข้อมูลหลายจุดพร้อมกัน (batch) — เหมาะกับการเทียบสองจังหวะ เช่นนาทีที่ออกตัว vs นาทีที่เหนื่อยสุด

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `ids` | string | yes | list ของ `point_id` คั่นด้วย comma เช่น `15,28,42` |

```bash
curl "http://localhost:3000/api/v1/run/session/1/points?ids=15,28" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response 200**
```json
{
  "session_id": 1,
  "requested_ids": [15, 28],
  "count": 2,
  "points": [
    {
      "point_id": 15,
      "elapsed_sec": 180,
      "recorded_at": "2026-05-26T06:03:00+07:00",
      "location":   { "lat": 13.7308, "lng": 100.5418, "elevation_m": 12.5, "distance_km": 0.521, "current_pace_sec": 345 },
      "environment":{ "temperature": 32.4, "feels_like": 38.1, "humidity": 68.0, "aqi": 87, "pm25": 42.3, "pm10": 65.1, "co": 0.412, "uv_index": 7.2, "wind_speed": 2.1, "wind_direction": 180.0, "cloud_cover_pct": 35.0, "rain_probability": 10.0 },
      "biometric": { "heart_rate_bpm": 152, "blood_oxygen_pct": 97.5, "hrv_ms": 45.2, "vo2max": 48.5, "cadence_spm": 168, "respiratory_rate_bpm": 28.5, "calories_burned_kcal": 42.50 }
    },
    {
      "point_id": 28,
      "elapsed_sec": 600,
      "recorded_at": "2026-05-26T06:10:00+07:00",
      "location":   { "...": "..." },
      "environment":{ "...": "..." },
      "biometric":  { "...": "..." }
    }
  ]
}
```

> - `points` เรียงตาม `elapsed_sec` (น้อย → มาก) ไม่ใช่ตามลำดับใน `ids`
> - `id` ที่ไม่ใช่ของ session นี้จะถูกข้าม (ไม่ error) — `count` จะน้อยกว่า `requested_ids.length`
> - ส่ง `ids` ว่างหรือ malformed → 400

---

### 14. GET /api/v1/run/weekly

7-day summary

```bash
curl http://localhost:3000/api/v1/run/weekly \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "total_distance_km": 17.8,
  "total_sessions": 3,
  "avg_pace_sec": 387
}
```

> Convert pace: `Math.floor(v/60) + ":" + (v%60).toString().padStart(2,"0")`

---

### 15. GET /api/v1/run/monthly

Monthly summary — use when user changes month on the calendar

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `year` | number | Yes | ปี เช่น `2026` |
| `month` | number | Yes | เดือน 1–12 |

```bash
curl "http://localhost:3000/api/v1/run/monthly?year=2026&month=5" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
{
  "total_distance_km": 38.1,
  "total_sessions": 6,
  "total_duration_sec": 15153,
  "avg_pace_sec": 392,
  "best_score": "91.00",
  "avg_score": "77.27"
}
```

---

### 16. GET /api/v1/run/nearby

ค้นหา sessions ที่ route ผ่านใกล้พิกัดที่กำหนด (PostGIS `ST_DWithin` บน `route_geom`)  
`start_lat/lng` derive จาก `run_location_point` (จุดที่มี `elapsed_sec` น้อยสุด)

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `lat` | number | Yes | Latitude จุดอ้างอิง |
| `lng` | number | Yes | Longitude จุดอ้างอิง |
| `radius_km` | number | No | รัศมี กม. (default: 5) |
| `limit` | number | No | จำนวนผลลัพธ์ (default: 10) |

```bash
curl "http://localhost:3000/api/v1/run/nearby?lat=13.7300&lng=100.5440&radius_km=2" \
  -H "Authorization: Bearer <your_access_token>"
```

**Response**
```json
[
  {
    "id": 1,
    "started_at": "2026-05-24T06:00:00.000Z",
    "distance_km": "5.20",
    "duration_sec": 2100,
    "avg_pace_sec": 403,
    "start_lat": "13.7283000",
    "start_lng": "100.5418000",
    "route_polyline": null,
    "overall_score": "78.50",
    "grade": "good",
    "nearest_distance_km": "0.18"
  }
]
```

> `nearest_distance_km` = ระยะทางสั้นสุดจากจุดค้นหาถึงเส้น route (ไม่ใช่แค่ start point)

---

### 17. GET /api/v1/run/env  (Public)

สภาพแวดล้อมปัจจุบัน ณ พิกัด — mock data (ไม่ต้อง token)

> ค่าสุ่มใหม่ทุกครั้งที่เรียก อยู่ในช่วงที่สมเหตุผลของกรุงเทพฯ (เช่น temperature 29–36, aqi 40–130, uv_index 2–11) — ค่าตัวอย่างด้านล่างเป็นแค่รูปแบบ response

| Query Param | Type | Required |
|-------------|------|----------|
| `lat` | number | Yes |
| `lng` | number | Yes |

```bash
curl "http://localhost:3000/api/v1/run/env?lat=13.7283&lng=100.5418"
```

**Response**
```json
{
  "lat": 13.7283,
  "lng": 100.5418,
  "temperature": 32.5,
  "feels_like": 38.2,
  "heat_index": 38.2,
  "humidity": 72,
  "pm25": 24.5,
  "pm10": 38.0,
  "co": 0.42,
  "aqi": 75,
  "uv_index": 7.2,
  "wind_speed": 12.0,
  "wind_direction": 180,
  "cloud_cover_pct": 35,
  "rain_probability": 20,
  "recorded_at": "2026-05-25T10:00:00.000Z"
}
```

---

### 18. POST /api/v1/run/submit

บันทึกข้อมูลการวิ่งแบบ batch — device เก็บข้อมูลทุก 1 นาที แล้วส่งทั้งหมดมาครั้งเดียวหลังวิ่งเสร็จ

> **`watch_points` เป็น optional** — ละไว้หรือส่ง `[]` ถ้าไม่ได้ใส่ smartwatch  
> ถ้าส่ง `watch_points` มา จำนวนต้องเท่ากับ `location_points` (1-to-1)  
> Server จะคำนวณและ INSERT `run_environment_summary`, `run_smart_watch_summary`, `run_scores` ในทรานแซกชันเดียวกัน  
> **ต้องมี `weight_kg` ใน user profile** ก่อน submit (มิฉะนั้น 400 — ใช้ POST `/users/me/profile` อัปเดต)

**Body fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `started_at` | ISO datetime | Yes | เวลาเริ่มวิ่ง (timestamptz, Asia/Bangkok) |
| `ended_at` | ISO datetime | Yes | เวลาสิ้นสุด |
| `duration_sec` | number | No | เวลารวม (วินาที) |
| `avg_pace_sec` | number | No | Pace เฉลี่ย (วินาที/กม.) |
| `min_pace_sec` | number | No | Pace เร็วสุด |
| `max_pace_sec` | number | No | Pace ช้าสุด |
| `route_polyline` | string | No | Google Encoded Polyline (เก็บแบบ compact) |
| `route_coordinates` | array `[[lng, lat], ...]` | No | **ใช้สร้าง `route_geom` ตรงๆ** ถ้าไม่ส่งจะ fallback ไปใช้ `location_points` |
| `location_points` | array | No | GPS + environment ทุก 1 นาที |
| `watch_points` | array | No | Biometric จาก smartwatch — optional |

**`location_points[]` fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `elapsed_sec` | number | Yes | วินาทีนับจากเริ่มวิ่ง |
| `recorded_at` | ISO datetime | Yes | เวลาที่บันทึก |
| `lat` | number | Yes | Latitude |
| `lng` | number | Yes | Longitude |
| `distance_km` | number | No | ระยะสะสม ณ จุดนี้ |
| `current_pace_sec` | number | No | Pace ณ จุดนี้ |
| `elevation_m` | number | No | ความสูง (เมตร) |
| `temperature` | number | No | อุณหภูมิ (°C) |
| `humidity` | number | No | ความชื้น (%) |
| `feels_like` | number | No | อุณหภูมิที่รู้สึก (°C) |
| `aqi` | number | No | Air Quality Index |
| `pm25` | number | No | PM2.5 (μg/m³) |
| `pm10` | number | No | PM10 (μg/m³) |
| `co` | number | No | CO (ppm) |
| `uv_index` | number | No | UV Index |
| `wind_speed` | number | No | ความเร็วลม (km/h) |
| `wind_direction` | number | No | ทิศทางลม (degrees) **NEW** |
| `cloud_cover_pct` | number | No | % เมฆปกคลุม **NEW** |
| `rain_probability` | number | No | % โอกาสฝน **NEW** |

**`watch_points[]` fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `elapsed_sec` | number | Yes | ต้องตรงกับ location_points |
| `recorded_at` | ISO datetime | Yes | เวลาที่บันทึก |
| `heart_rate_bpm` | number | No | อัตราการเต้นหัวใจ |
| `blood_oxygen_pct` | number | No | SpO2 (%) |
| `hrv_ms` | number | No | Heart Rate Variability (ms) |
| `vo2max` | number | No | VO2 Max ณ จุดนี้ |
| `cadence_spm` | number | No | ก้าว/นาที |
| `respiratory_rate_bpm` | number | No | อัตราการหายใจ |
| `calories_burned_kcal` | number | No | แคลอรี่สะสม (cumulative) |

**ตัวอย่าง 1 — วิ่งพร้อม smartwatch**

```bash
curl -X POST http://localhost:3000/api/v1/run/submit \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "started_at": "2026-05-25T06:00:00.000Z",
    "ended_at":   "2026-05-25T06:35:00.000Z",
    "duration_sec": 2100,
    "avg_pace_sec": 403,
    "min_pace_sec": 358,
    "max_pace_sec": 450,
    "route_polyline": "{hxrAgatdR{OgYgc@fEoFnd@",
    "route_coordinates": [
      [100.5418, 13.7283],
      [100.5430, 13.7293],
      [100.5445, 13.7302],
      [100.5455, 13.7308],
      [100.5460, 13.7310]
    ],
    "location_points": [
      {
        "elapsed_sec": 0, "recorded_at": "2026-05-25T06:00:00.000Z",
        "lat": 13.7283, "lng": 100.5418,
        "distance_km": 0.00, "current_pace_sec": null, "elevation_m": 1.5,
        "temperature": 31.2, "humidity": 74.0, "feels_like": 37.5,
        "aqi": 75, "pm25": 24.5, "pm10": 38.0, "co": 0.42,
        "uv_index": 6.8, "wind_speed": 12.0, "wind_direction": 180,
        "cloud_cover_pct": 35, "rain_probability": 20
      },
      {
        "elapsed_sec": 700, "recorded_at": "2026-05-25T06:11:40.000Z",
        "lat": 13.7292, "lng": 100.5432,
        "distance_km": 1.73, "current_pace_sec": 405, "elevation_m": 1.5,
        "temperature": 31.2, "humidity": 74.0, "feels_like": 37.5,
        "aqi": 75, "pm25": 24.5, "pm10": 38.0, "co": 0.42,
        "uv_index": 6.8, "wind_speed": 12.0, "wind_direction": 180,
        "cloud_cover_pct": 35, "rain_probability": 20
      }
    ],
    "watch_points": [
      {
        "elapsed_sec": 0, "recorded_at": "2026-05-25T06:00:00.000Z",
        "heart_rate_bpm": 142, "blood_oxygen_pct": 99.0,
        "hrv_ms": 52.0, "vo2max": 44.2,
        "cadence_spm": 155, "respiratory_rate_bpm": 22.0,
        "calories_burned_kcal": 0.0
      },
      {
        "elapsed_sec": 700, "recorded_at": "2026-05-25T06:11:40.000Z",
        "heart_rate_bpm": 165, "blood_oxygen_pct": 97.5,
        "hrv_ms": 22.0, "vo2max": 50.1,
        "cadence_spm": 171, "respiratory_rate_bpm": 29.0,
        "calories_burned_kcal": 248.5
      }
    ]
  }'
```

**ตัวอย่าง 2 — วิ่งโดยไม่มี smartwatch** (ละ `watch_points` ได้เลย)

```bash
curl -X POST http://localhost:3000/api/v1/run/submit \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "started_at": "2026-05-25T06:00:00.000Z",
    "ended_at":   "2026-05-25T06:35:00.000Z",
    "duration_sec": 2100,
    "avg_pace_sec": 403,
    "location_points": [
      {
        "elapsed_sec": 0, "recorded_at": "2026-05-25T06:00:00.000Z",
        "lat": 13.7283, "lng": 100.5418,
        "distance_km": 0.00, "elevation_m": 1.5,
        "temperature": 31.2, "humidity": 74.0, "aqi": 75
      },
      {
        "elapsed_sec": 700, "recorded_at": "2026-05-25T06:11:40.000Z",
        "lat": 13.7292, "lng": 100.5432,
        "distance_km": 1.73, "current_pace_sec": 405, "elevation_m": 1.5,
        "temperature": 31.2, "humidity": 74.0, "aqi": 75
      }
    ]
  }'
```

**Response** `201 Created`
```json
{
  "session_id": 11,
  "overall_score": 80.45,
  "grade": "good",
  "calories_burned_kcal": 322
}
```

**Server auto-derives (single transaction):**
- `route_geom` (PostGIS LineString) — สร้างจาก `route_coordinates` ถ้ามี, ไม่งั้น fallback `location_points[].lat/lng`
- `run_environment_summary` — AVG/MIN/MAX จาก `location_points`
- `run_smart_watch_summary` — AVG/MIN/MAX จาก `watch_points` (ถ้ามี)
- `run_scores` — MET-based calories + ActivityScore + PMScore + HeatScore + grade

---

## Error Responses

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "message": "lat and lng are required" }` | Missing query params |
| `400` | `{ "message": "watch_points must have the same length as location_points" }` | Array length mismatch (เมื่อส่ง watch_points มา) |
| `400` | `{ "message": "User weight is required. Please update your profile before submitting a run." }` | `weight_kg` ใน profile ว่าง — submit ไม่ได้ |
| `400` | `{ "message": "year and month are required" }` | Missing monthly params |
| `401` | `{ "message": "Invalid email or password" }` | Email not found |
| `401` | `{ "message": "Invalid refresh token" }` | Token expired or invalid |
| `404` | `{ "message": "Session not found" }` | Session does not exist or not owned by user |
| `404` | `{ "message": "User not found" }` | User not found |
| `500` | `{ "message": "..." }` | Server / DB error |