# Lanyard Request Portal

Website statis + Vercel Function untuk input data lanyard karyawan dan dashboard admin.

## Route

- `/` halaman user untuk submit pengajuan.
- `/admin/login/` halaman login admin.
- `/admin/` dashboard admin.
- `/api/requests` API database untuk data pengajuan.

## Deploy ke Vercel

1. Upload project ini ke GitHub.
2. Import repository ke Vercel.
3. Tambahkan Postgres database dari Vercel Marketplace, misalnya Neon atau Prisma Postgres.
4. Tambahkan Vercel Blob store dari Vercel Storage.
5. Pastikan Vercel project punya environment variable `DATABASE_URL` atau `POSTGRES_URL`.
6. Pastikan Vercel project punya environment variable `BLOB_READ_WRITE_TOKEN`.
7. Jika Blob store kamu private, tambahkan `BLOB_ACCESS=private`. Jika Blob store public, tidak perlu menambahkan env ini.
8. Deploy.

Tabel `lanyard_requests` akan dibuat otomatis saat API pertama kali dipanggil.

## Catatan

Foto disimpan di Vercel Blob. Secara default kode memakai Blob public store karena itu konfigurasi default Vercel. Jika kamu memakai private store, set environment variable `BLOB_ACCESS=private`; admin akan mengambil foto lewat endpoint `/api/file`.

## Troubleshooting

Jika muncul pesan `Upload foto ke Blob gagal`, cek hal berikut:

1. Vercel Blob sudah dibuat dan terhubung ke project.
2. Environment variable `BLOB_READ_WRITE_TOKEN` ada di Vercel project.
3. Setelah menambahkan Blob/env, lakukan redeploy.
4. Buka website dari URL Vercel, bukan langsung dari file lokal, karena endpoint `/api/upload` hanya berjalan di server Vercel atau `vercel dev`.
5. Ukuran foto tidak lebih dari 2MB.
