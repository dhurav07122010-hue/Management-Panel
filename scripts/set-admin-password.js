import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

const newPassword = process.argv[2] || 'admin123';
const dbPath = path.resolve(process.cwd(), './data/panel.sqlite');

const db = new DatabaseSync(dbPath);
const hash = await bcrypt.hash(newPassword, 12);

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

if (existing) {
  db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, 'admin');
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  console.log(`\n[SUCCESS] Password for user 'admin' updated to: ${newPassword}\n`);
} else {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, 'admin', hash, now);
  console.log(`\n[SUCCESS] Admin user created!`);
  console.log(`Username: admin`);
  console.log(`Password: ${newPassword}\n`);
}

db.close();
