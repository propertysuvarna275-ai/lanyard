import { get } from "@vercel/blob";
import { Readable } from "node:stream";

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function getBlobAccess() {
  return process.env.BLOB_ACCESS === "private" ? "private" : "public";
}

function pipeBlobResult(result, pathname, res) {
  if (result.statusCode === 304) {
    res.setHeader("ETag", result.blob.etag);
    res.setHeader("Cache-Control", "private, no-cache");
    return res.status(304).end();
  }

  res.setHeader("Content-Type", result.blob.contentType || "application/octet-stream");
  res.setHeader("ETag", result.blob.etag);
  res.setHeader("Cache-Control", "private, no-cache");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(pathname.split("/").pop() || "foto-lanyard")}"`);

  return Readable.fromWeb(result.stream).pipe(res);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method tidak diizinkan.");
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return sendError(res, 500, "BLOB_READ_WRITE_TOKEN belum diatur.");
    }

    const pathname = req.query.pathname;
    if (!pathname) {
      return sendError(res, 400, "Pathname foto wajib dikirim.");
    }

    const ifNoneMatch = req.headers["if-none-match"] || undefined;
    let result;

    try {
      result = await get(pathname, {
        access: getBlobAccess(),
        ifNoneMatch
      });
    } catch (error) {
      const message = error.message || "";
      if (!message.includes("Cannot use")) {
        throw error;
      }

      const fallbackAccess = getBlobAccess() === "private" ? "public" : "private";
      result = await get(pathname, {
        access: fallbackAccess,
        ifNoneMatch
      });
    }

    if (!result) {
      return res.status(404).send("Foto tidak ditemukan.");
    }

    return pipeBlobResult(result, pathname, res);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, `Gagal mengambil foto: ${error.message || "penyebab tidak diketahui"}`);
  }
}
