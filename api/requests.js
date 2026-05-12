import { randomUUID } from "node:crypto";
import postgres from "postgres";

const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "PRINT READY", "DONE"]);
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = connectionString ? postgres(connectionString, { ssl: "require" }) : null;

async function ensureTable() {
  if (!sql) {
    throw new Error("DATABASE_URL atau POSTGRES_URL belum diatur di Vercel.");
  }

  await sql`
    CREATE TABLE IF NOT EXISTS lanyard_requests (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      employee_id TEXT,
      unit TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      photo_name TEXT,
      photo_type TEXT,
      photo_url TEXT,
      photo_pathname TEXT,
      photo_access TEXT NOT NULL DEFAULT 'public',
      photo_data_url TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE lanyard_requests ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE lanyard_requests ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE lanyard_requests ADD COLUMN IF NOT EXISTS photo_url TEXT`;
  await sql`ALTER TABLE lanyard_requests ADD COLUMN IF NOT EXISTS photo_pathname TEXT`;
  await sql`ALTER TABLE lanyard_requests ADD COLUMN IF NOT EXISTS photo_access TEXT NOT NULL DEFAULT 'public'`;
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lanyard_requests' AND column_name = 'division'
      ) THEN
        ALTER TABLE lanyard_requests ALTER COLUMN division DROP NOT NULL;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lanyard_requests' AND column_name = 'blood_type'
      ) THEN
        ALTER TABLE lanyard_requests ALTER COLUMN blood_type DROP NOT NULL;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lanyard_requests' AND column_name = 'employee_id'
      ) THEN
        ALTER TABLE lanyard_requests ALTER COLUMN employee_id DROP NOT NULL;
      END IF;
    END $$;
  `;

  await sql`
    UPDATE lanyard_requests
    SET unit = employee_id
    WHERE unit = '' AND employee_id IS NOT NULL
  `;
}

function mapRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    unit: row.unit || row.employee_id,
    position: row.position,
    photoName: row.photo_name,
    photoType: row.photo_type,
    photoUrl: row.photo_url,
    photoPathname: row.photo_pathname,
    photoAccess: row.photo_access,
    photoDataUrl: row.photo_data_url,
    status: row.status,
    submittedAt: row.submitted_at
  };
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body);
  return req.body;
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

export default async function handler(req, res) {
  try {
    await ensureTable();

    if (req.method === "GET") {
      const result = await sql`
        SELECT *
        FROM lanyard_requests
        ORDER BY submitted_at DESC
      `;

      return res.status(200).json({ data: result.map(mapRow) });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const required = ["fullName", "unit", "position", "photoUrl"];
      const missing = required.filter((field) => !String(body[field] || "").trim());

      if (missing.length) {
        return sendError(res, 400, `Field wajib belum lengkap: ${missing.join(", ")}`);
      }

      const id = randomUUID();
      const result = await sql`
        INSERT INTO lanyard_requests (
          id,
          full_name,
          employee_id,
          unit,
          position,
          photo_name,
          photo_type,
          photo_url,
          photo_pathname,
          photo_access,
          status
        )
        VALUES (
          ${id},
          ${body.fullName.trim()},
          ${body.unit.trim()},
          ${body.unit.trim()},
          ${body.position.trim()},
          ${body.photoName || null},
          ${body.photoType || null},
          ${body.photoUrl},
          ${body.photoPathname || null},
          ${body.photoAccess === "private" ? "private" : "public"},
          'PENDING'
        )
        RETURNING *
      `;

      return res.status(201).json({ data: mapRow(result[0]) });
    }

    if (req.method === "PATCH") {
      const body = parseBody(req);

      if (!body.id) {
        return sendError(res, 400, "ID pengajuan wajib dikirim.");
      }

      if (!VALID_STATUSES.has(body.status)) {
        return sendError(res, 400, "Status pengajuan tidak valid.");
      }

      const result = await sql`
        UPDATE lanyard_requests
        SET status = ${body.status}, updated_at = NOW()
        WHERE id = ${body.id}
        RETURNING *
      `;

      if (!result.count) {
        return sendError(res, 404, "Data pengajuan tidak ditemukan.");
      }

      return res.status(200).json({ data: mapRow(result[0]) });
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return sendError(res, 405, "Method tidak diizinkan.");
  } catch (error) {
    console.error(error);
    return sendError(res, 500, "Server database belum siap atau terjadi kesalahan.");
  }
}
