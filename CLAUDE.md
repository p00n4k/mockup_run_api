# CLAUDE.md — mockup_run_api

## Project Overview

Mockup REST API สำหรับ Flood Running App — ติดตามข้อมูลการวิ่งพร้อม biometric จาก smartwatch และ environment data (AQI, UV, อุณหภูมิ)

Stack: **Node.js + Express 5 + PostgreSQL + PostGIS**

---

## Running the Server

```bash
npm run dev      # nodemon (auto-reload)
npm start        # node index.js
```

Base URL: `http://localhost:3000`

**Dev mode:** Auth middleware ถูก bypass — ทุก protected endpoint ใช้ `user_id = 1` อัตโนมัติ ไม่ต้องส่ง token จริง

---

## Environment Variables (.env)

```
DATABASE_URL=postgresql://user:password@localhost:5432/flood_run
JWT_SECRET=any_secret_string
PORT=3000
```

---

## Database Setup

```bash
# 1. สร้าง schema + tables
psql $DATABASE_URL -f base.sql

# 2. ใส่ mock data
psql $DATABASE_URL -f mock.sql
```

ต้องการ PostgreSQL + PostGIS extension (`CREATE EXTENSION IF NOT EXISTS postgis;` อยู่ใน base.sql แล้ว)

---

## Database Schema

### Schemas
- `identity` — ข้อมูล user, profile, health stats จาก smartwatch
- `running` — ข้อมูลการวิ่ง sessions, points, scores

### Key Tables

| Table | Description |
|-------|-------------|
| `identity.users` | User accounts |
| `identity.user_profiles` | ข้อมูลร่างกาย (ส่วนสูง น้ำหนัก ฯลฯ) |
| `identity.user_health_stats_smart_watch` | Health baseline จาก smartwatch (VO2max, HRV, sleep ฯลฯ) |
| `identity.run_smart_watch_summary` | Aggregate biometric ต่อ session |
| `running.run_sessions` | Session หลัก — route, pace, distance |
| `running.run_location_point` | GPS + environment ทุก 1 นาที |
| `running.run_watch_point` | Biometric จาก smartwatch ทุก 1 นาที (1-to-1 กับ run_location_point) |
| `running.run_environment_summary` | Aggregate environment ต่อ session |
| `running.run_scores` | คะแนนสภาพแวดล้อมต่อ session (overall, heat, AQI, UV ฯลฯ) |

### Critical Relationships
- `run_watch_point.location_point_id` → `run_location_point.id` **(1-to-1)** — watch point ไม่ได้ link ตรงกับ session แต่ link ผ่าน location point
- `run_location_point.session_id` → `run_sessions.id`
- `run_smart_watch_summary.session_id` → `run_sessions.id`

### Schema Files
- **`base.sql`** — DDL: CREATE TABLE ทั้งหมด (ลำดับสำคัญ: `run_location_point` ก่อน `run_watch_point`)
- **`mock.sql`** — INSERT data: 3 users, 10 sessions, 40 location/watch points
- **`dbdiagram.dbml`** — ERD สำหรับ paste ที่ [dbdiagram.io](https://dbdiagram.io/d)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login คืน JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/users/me` | User info |
| GET | `/api/v1/users/me/profile` | Full profile + health stats + avg scores |
| POST | `/api/v1/users/me/profile` | อัปเดต profile |
| GET | `/api/v1/run/session_history` | ประวัติการวิ่ง (paginated) |
| GET | `/api/v1/run/session/:id` | Session overview — stats + scores |
| GET | `/api/v1/run/session/:id/route` | Route geometry + per-minute coordinate/pace/elevation |
| GET | `/api/v1/run/session/:id/env/summary` | Environment summary (AVG/MIN/MAX) |
| GET | `/api/v1/run/session/:id/env/points` | Per-minute env readings |
| GET | `/api/v1/run/session/:id/biometric/summary` | Smartwatch summary (AVG/MIN/MAX) |
| GET | `/api/v1/run/session/:id/biometric/points` | Per-minute biometric readings |
| GET | `/api/v1/run/session/:id/point/:point_id` | จุดเดียว — location + env + biometric รวมกัน |
| GET | `/api/v1/run/session/:id/points?ids=…` | หลายจุดพร้อมกัน (batch by point_id) |
| GET | `/api/v1/run/weekly` | สรุป 7 วันย้อนหลัง |
| GET | `/api/v1/run/nearby` | ค้นหา session ใกล้พิกัด (PostGIS) |
| GET | `/api/v1/run/env` | สภาพแวดล้อม ณ พิกัด (mock, public) |
| POST | `/api/v1/run/submit` | บันทึก session + points batch |

ดูรายละเอียดทุก endpoint ที่ **`API_DOCS.md`**

---

## POST /api/v1/run/submit — Batch Flow

Device เก็บข้อมูลทุก 1 นาทีระหว่างวิ่ง แล้วส่งทั้งหมดมาครั้งเดียวเมื่อวิ่งเสร็จ

```
client → POST /run/submit
           { location_points: [...], watch_points: [...] }
           (watch_points optional — ละไว้หรือส่ง [] ถ้าไม่มี smartwatch)

server (1 transaction):
  1. INSERT run_sessions
  2. INSERT run_location_point (batch via unnest)  → ได้ IDs
  3. INSERT run_watch_point    (batch via unnest, ใช้ IDs จากข้อ 2) — ข้ามถ้า watch_points ว่าง
  4. INSERT run_environment_summary  (auto-aggregate จาก location_points)
  5. INSERT run_smart_watch_summary  (auto-aggregate จาก watch_points) — ว่างถ้าไม่มีข้อมูล
```

`watch_points` เป็น **optional** — ถ้าส่งมาต้องมี length เท่ากับ `location_points` (1-to-1)

---

## run_watch_point Fields

Biometric per-point ที่ smartwatch เก็บ:

| Field | Description |
|-------|-------------|
| `location_point_id` | FK → run_location_point (1-to-1) |
| `heart_rate_bpm` | อัตราการเต้นหัวใจ |
| `blood_oxygen_pct` | SpO2 (%) |
| `hrv_ms` | Heart Rate Variability (ms) — สูงตอนเริ่ม ลดเมื่อเหนื่อย |
| `vo2max` | VO2 Max ประมาณ real-time — เพิ่มขึ้นตาม effort |
| `cadence_spm` | จำนวนก้าว/นาที |
| `respiratory_rate_bpm` | อัตราการหายใจ |
| `calories_burned_kcal` | แคลอรี่สะสม (cumulative) |

---

## Mock Data Summary

| User | Sessions | Location |
|------|----------|----------|
| Pawin (id=1) | 6 sessions | สวนลุมพินี, จตุจักร, รัชดา |
| Mali (id=2) | 2 sessions | สวนลุมพินี, จตุจักร |
| Niran (id=3) | 2 sessions | สวนลุมพินี, รัชดา |

40 location points + 40 watch points (IDs 1–40, 4 points/session)

---

## File Structure

```
index.js          ← Express app + all route handlers
base.sql          ← DDL (CREATE TABLE)
mock.sql          ← Seed data (INSERT)
dbdiagram.dbml    ← ERD schema (dbdiagram.io format)
API_DOCS.md       ← Full API documentation with curl examples
package.json
.env              ← DATABASE_URL, JWT_SECRET, PORT (ไม่ commit)
```
