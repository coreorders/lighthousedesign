import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import multer from "multer";
import { ensureDefaultAdmin, requireAdmin, requireClient, signAdmin, signClient } from "./auth.js";
import { pool, query } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.resolve(__dirname, "..", "uploads");
const app = express();
const port = Number(process.env.API_PORT || 3000);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadRoot));

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(uploadRoot, req.params.siteId, req.params.date);
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("이미지 파일만 업로드할 수 있습니다."));
    cb(null, true);
  },
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/sites/:slug/verify", async (req, res) => {
  const { password } = req.body;
  const site = await findPublicSite(req.params.slug);
  if (!site || site.access_password !== password) {
    return res.status(401).json({ error: "현장명 또는 비밀번호가 올바르지 않습니다." });
  }
  res.json({ token: signClient(site), site: publicSite(site) });
});

app.get("/api/sites/:slug/calendar", requireClient, async (req, res) => {
  const site = await findPublicSite(req.params.slug);
  if (!site || site.id !== req.clientSiteId) return res.status(404).json({ error: "현장을 찾을 수 없습니다." });
  res.json({ site: publicSite(site), entries: await loadCalendar(site.id) });
});

app.get("/api/sites/:slug/memos", requireClient, async (req, res) => {
  const site = await findPublicSite(req.params.slug);
  if (!site || site.id !== req.clientSiteId) return res.status(404).json({ error: "현장을 찾을 수 없습니다." });
  const memos = await query(
    "SELECT id, author_type, author_name, content, created_at FROM memos WHERE site_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT 100",
    [site.id],
  );
  res.json({ memos: memos.rows });
});

app.post("/api/sites/:slug/memos", requireClient, async (req, res) => {
  const site = await findPublicSite(req.params.slug);
  const content = String(req.body.content || "").trim();
  const authorName = String(req.body.authorName || "고객").trim();
  if (!site || site.id !== req.clientSiteId) return res.status(404).json({ error: "현장을 찾을 수 없습니다." });
  if (!content) return res.status(400).json({ error: "메모 내용을 입력해주세요." });
  const inserted = await query(
    "INSERT INTO memos (site_id, author_type, author_name, content) VALUES ($1, 'client', $2, $3) RETURNING id, author_type, author_name, content, created_at",
    [site.id, authorName, content],
  );
  res.status(201).json({ memo: inserted.rows[0] });
});

app.post("/api/admin/login", async (req, res) => {
  const { password } = req.body;
  const username = String(req.body.username || req.body.email || "").trim();
  const result = await query("SELECT * FROM admins WHERE email = $1", [username]);
  const admin = result.rows[0];
  if (!admin || !(await bcrypt.compare(password || "", admin.password_hash))) {
    return res.status(401).json({ error: "관리자 로그인 정보가 올바르지 않습니다." });
  }
  res.json({ token: signAdmin(admin), admin: { id: admin.id, username: admin.email } });
});

app.get("/api/admin/sites", requireAdmin, async (req, res) => {
  const result = await query("SELECT * FROM sites ORDER BY created_at DESC");
  res.json({ sites: result.rows });
});

app.get("/api/admin/sites/:siteId/calendar", requireAdmin, async (req, res) => {
  const site = await query("SELECT id FROM sites WHERE id = $1 AND status <> 'deleted'", [req.params.siteId]);
  if (!site.rows[0]) return res.status(404).json({ error: "현장을 찾을 수 없습니다." });
  res.json({ entries: await loadCalendar(req.params.siteId) });
});

app.post("/api/admin/sites/:siteId/preview-token", requireAdmin, async (req, res) => {
  const result = await query("SELECT * FROM sites WHERE id = $1 AND status <> 'deleted'", [req.params.siteId]);
  const site = result.rows[0];
  if (!site) return res.status(404).json({ error: "현장을 찾을 수 없습니다." });
  res.json({ token: signClient(site), slug: site.slug });
});

app.post("/api/admin/sites", requireAdmin, async (req, res) => {
  const slug = slugify(req.body.slug || req.body.name);
  const name = String(req.body.name || "").trim();
  const accessPassword = String(req.body.accessPassword || "").trim();
  if (!slug || !name || !accessPassword) {
    return res.status(400).json({ error: "현장명, URL 이름, 비밀번호가 필요합니다." });
  }
  const inserted = await query(
    "INSERT INTO sites (slug, name, access_password, notice) VALUES ($1, $2, $3, $4) RETURNING *",
    [slug, name, accessPassword, req.body.notice || ""],
  );
  res.status(201).json({ site: inserted.rows[0] });
});

app.patch("/api/admin/sites/:siteId", requireAdmin, async (req, res) => {
  const result = await query(
    `UPDATE sites
     SET name = COALESCE($2, name),
         access_password = COALESCE($3, access_password),
         notice = COALESCE($4, notice),
         status = COALESCE($5, status),
         completed_at = CASE WHEN $5 = 'completed' THEN now() ELSE completed_at END
     WHERE id = $1 AND status <> 'deleted'
     RETURNING *`,
    [req.params.siteId, req.body.name, req.body.accessPassword, req.body.notice, req.body.status],
  );
  if (!result.rows[0]) return res.status(404).json({ error: "현장을 찾을 수 없습니다." });
  res.json({ site: result.rows[0] });
});

app.delete("/api/admin/sites/:siteId", requireAdmin, async (req, res) => {
  if (req.query.mode === "purge") {
    await query("DELETE FROM sites WHERE id = $1", [req.params.siteId]);
    await fs.rm(path.join(uploadRoot, req.params.siteId), { recursive: true, force: true });
    return res.json({ ok: true, mode: "purge" });
  }
  await query("UPDATE sites SET status = 'deleted', deleted_at = now() WHERE id = $1", [req.params.siteId]);
  res.json({ ok: true, mode: "soft" });
});

app.put("/api/admin/sites/:siteId/calendar/:date", requireAdmin, async (req, res) => {
  const result = await query(
    `INSERT INTO calendar_entries (site_id, entry_date, schedule_text, detail_text)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (site_id, entry_date)
     DO UPDATE SET
       schedule_text = EXCLUDED.schedule_text,
       detail_text = EXCLUDED.detail_text,
       updated_at = now()
     RETURNING *`,
    [req.params.siteId, req.params.date, req.body.scheduleText || "", req.body.detailText || ""],
  );
  res.json({ entry: result.rows[0] });
});

app.delete("/api/admin/calendar/:entryId", requireAdmin, async (req, res) => {
  await query("DELETE FROM calendar_entries WHERE id = $1", [req.params.entryId]);
  res.json({ ok: true });
});

app.post("/api/admin/sites/:siteId/calendar/:date/photos", requireAdmin, upload.array("photos"), async (req, res) => {
  const entry = await query(
    `INSERT INTO calendar_entries (site_id, entry_date)
     VALUES ($1, $2)
     ON CONFLICT (site_id, entry_date) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [req.params.siteId, req.params.date],
  );
  const photos = [];
  for (const file of req.files || []) {
    const relativePath = `/uploads/${req.params.siteId}/${req.params.date}/${file.filename}`;
    const inserted = await query(
      `INSERT INTO photos (entry_id, site_id, original_name, stored_name, file_path, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [entry.rows[0].id, req.params.siteId, file.originalname, file.filename, relativePath, file.mimetype, file.size],
    );
    photos.push(inserted.rows[0]);
  }
  res.status(201).json({ photos });
});

app.delete("/api/admin/photos/:photoId", requireAdmin, async (req, res) => {
  const result = await query("DELETE FROM photos WHERE id = $1 RETURNING file_path", [req.params.photoId]);
  const photo = result.rows[0];
  if (photo) await fs.rm(path.join(uploadRoot, photo.file_path.replace("/uploads/", "")), { force: true });
  res.json({ ok: true });
});

app.post("/api/admin/sites/:siteId/memos", requireAdmin, async (req, res) => {
  const content = String(req.body.content || "").trim();
  if (!content) return res.status(400).json({ error: "메모 내용을 입력해주세요." });
  const inserted = await query(
    "INSERT INTO memos (site_id, author_type, author_name, content) VALUES ($1, 'admin', $2, $3) RETURNING *",
    [req.params.siteId, req.body.authorName || "관리자", content],
  );
  res.status(201).json({ memo: inserted.rows[0] });
});

app.delete("/api/admin/memos/:memoId", requireAdmin, async (req, res) => {
  await query("UPDATE memos SET is_deleted = true WHERE id = $1", [req.params.memoId]);
  res.json({ ok: true });
});

async function findPublicSite(slug) {
  const result = await query("SELECT * FROM sites WHERE slug = $1 AND status <> 'deleted'", [slug]);
  return result.rows[0] || null;
}

function publicSite(site) {
  return {
    id: site.id,
    slug: site.slug,
    name: site.name,
    notice: site.notice,
    status: site.status,
    completedAt: site.completed_at,
  };
}

async function loadCalendar(siteId) {
  const entries = await query(
    `SELECT ce.*, COALESCE(json_agg(p.*) FILTER (WHERE p.id IS NOT NULL), '[]') AS photos
     FROM calendar_entries ce
     LEFT JOIN photos p ON p.entry_id = ce.id
     WHERE ce.site_id = $1
     GROUP BY ce.id
     ORDER BY ce.entry_date ASC`,
    [siteId],
  );
  return entries.rows;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "서버 오류가 발생했습니다." });
});

async function ensureSchema() {
  await query("ALTER TABLE calendar_entries ADD COLUMN IF NOT EXISTS detail_text TEXT NOT NULL DEFAULT ''");
}

await fs.mkdir(uploadRoot, { recursive: true });
await ensureSchema();
await ensureDefaultAdmin();

const server = app.listen(port, () => {
  console.log(`Light House Design API listening on ${port}`);
});

process.on("SIGTERM", async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});
