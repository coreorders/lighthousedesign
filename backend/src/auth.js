import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "./db.js";

const jwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  return process.env.JWT_SECRET;
};

export function signAdmin(admin) {
  return jwt.sign({ role: "admin", adminId: admin.id, username: admin.email }, jwtSecret(), {
    expiresIn: "12h",
  });
}

export function signClient(site) {
  return jwt.sign({ role: "client", siteId: site.id, slug: site.slug }, jwtSecret(), {
    expiresIn: "7d",
  });
}

export function requireAdmin(req, res, next) {
  const payload = readBearer(req);
  if (!payload || payload.role !== "admin") {
    return res.status(401).json({ error: "관리자 인증이 필요합니다." });
  }
  req.admin = payload;
  next();
}

export function requireClient(req, res, next) {
  const payload = readBearer(req);
  if (!payload || payload.role !== "client") {
    return res.status(401).json({ error: "현장 비밀번호 확인이 필요합니다." });
  }
  req.clientSiteId = payload.siteId;
  next();
}

function readBearer(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret());
  } catch {
    return null;
  }
}

export async function ensureDefaultAdmin() {
  const email = process.env.ADMIN_ID || process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await query(
    `INSERT INTO admins (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, passwordHash],
  );
}
