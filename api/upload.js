import { put } from "@vercel/blob";

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function safeFilename(value) {
  return String(value || "foto-lanyard")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

function getBlobAccess() {
  return process.env.BLOB_ACCESS === "private" ? "private" : "public";
}

async function uploadWithAccess(pathname, body, options, preferredAccess) {
  try {
    const blob = await put(pathname, body, {
      ...options,
      access: preferredAccess
    });

    return { blob, access: preferredAccess };
  } catch (error) {
    const message = error.message || "";
    const accessMismatch = message.includes("Cannot use public access on a private store")
      || message.includes("Cannot use private access on a public store");

    if (!accessMismatch) {
      throw error;
    }

    const fallbackAccess = preferredAccess === "private" ? "public" : "private";
    const blob = await put(pathname, body, {
      ...options,
      access: fallbackAccess
    });

    return { blob, access: fallbackAccess };
  }
}

async function readRequestBuffer(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method tidak diizinkan.");
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return sendError(res, 500, "BLOB_READ_WRITE_TOKEN belum diatur. Connect Vercel Blob ke project lalu redeploy.");
    }

    const filename = safeFilename(req.query.filename);
    const contentType = req.headers["content-type"] || "application/octet-stream";

    if (!contentType.startsWith("image/")) {
      return sendError(res, 400, "File harus berupa gambar.");
    }

    const fileBuffer = await readRequestBuffer(req);

    if (!fileBuffer.length) {
      return sendError(res, 400, "File foto kosong atau gagal dibaca.");
    }

    const upload = await uploadWithAccess(`lanyard-photos/${Date.now()}-${filename}`, fileBuffer, {
      addRandomSuffix: true,
      contentType
    }, getBlobAccess());

    return res.status(200).json({
      url: upload.blob.url,
      pathname: upload.blob.pathname,
      access: upload.access
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, `Upload foto ke Blob gagal: ${error.message || "penyebab tidak diketahui"}`);
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
