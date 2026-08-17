/* =====================================================================
   G5 Auto — Express Backend  (server.js)
   Multi-user API with Turso (libSQL), JWT auth, file uploads
   =================================================================== */
const express = require('express');
const { createClient } = require('@libsql/client');
const { v2: cloudinary } = require('cloudinary');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'g5auto-secret-change-in-production-' + Date.now();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ---- Cloudinary config ----
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ---- File upload config (memory buffer for Cloudinary) ----
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

let db;

// ---- Database helpers (async for libsql) ----
async function run(sql, args) {
  await db.execute({ sql, args: args || [] });
}

async function get(sql, args) {
  const result = await db.execute({ sql, args: args || [] });
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function all(sql, args) {
  const result = await db.execute({ sql, args: args || [] });
  return result.rows;
}

// ---- Auth middleware ----
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

async function logActivity(userId, username, action, entityType, entityId, entityName, details) {
  await run(`INSERT INTO activity_log (user_id, username, action, entity_type, entity_id, entity_name, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, username, action, entityType || '', entityId || '', entityName || '', details || '']);
}

// ---- Auth routes ----
app.post('/api/auth/signup', async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be 4+ characters' });
  const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return res.status(409).json({ error: 'Username already taken' });
  const hash = bcrypt.hashSync(password, 10);
  await run('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)', [username, hash, displayName || username]);
  const user = await get('SELECT id, username, display_name FROM users WHERE username = ?', [username]);
  const token = jwt.sign({ id: user.id, username, displayName: user.display_name }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username, displayName: user.display_name } });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, displayName: user.display_name }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, mustChangePassword: !!user.must_change_password } });
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await get('SELECT id, username, display_name, role, must_change_password, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, displayName: user.display_name, role: user.role, mustChangePassword: !!user.must_change_password, created_at: user.created_at });
});

app.post('/api/auth/change-password', auth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Password must be 4+ characters' });
  const hash = bcrypt.hashSync(newPassword, 10);
  await run('UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?', [hash, req.user.id]);
  await logActivity(req.user.id, req.user.username, 'password_changed', 'user', req.user.id, req.user.username);
  res.json({ ok: true });
});

// ---- Vehicle routes ----
app.get('/api/vehicles', auth, async (req, res) => {
  const rows = await all('SELECT * FROM vehicles ORDER BY created_at DESC', []);
  res.json(rows.map(parseVehicle));
});

app.get('/api/vehicles/:id', auth, async (req, res) => {
  const v = await get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Not found' });
  res.json(parseVehicle(v));
});

app.post('/api/vehicles', auth, async (req, res) => {
  const id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const v = buildVehicleInsert(id, req.user.id, req.body);
  await run(v.sql, v.params);
  await logActivity(req.user.id, req.user.username, 'vehicle_added', 'vehicle', id, (req.body.make||'') + ' ' + (req.body.model||''), JSON.stringify({ purchasePrice: req.body.purchasePrice }));
  res.json(parseVehicle(await get('SELECT * FROM vehicles WHERE id = ?', [id])));
});

app.put('/api/vehicles/:id', auth, async (req, res) => {
  const existing = await get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const v = buildVehicleUpdate(req.params.id, req.body);
  await run(v.sql, v.params);
  await logActivity(req.user.id, req.user.username, 'vehicle_updated', 'vehicle', req.params.id, (req.body.make||'') + ' ' + (req.body.model||''));
  res.json(parseVehicle(await get('SELECT * FROM vehicles WHERE id = ?', [req.params.id])));
});

app.delete('/api/vehicles/:id', auth, async (req, res) => {
  const v = await get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Not found' });
  await run('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
  await run('DELETE FROM expenses WHERE vehicle_id = ?', [req.params.id]);
  await logActivity(req.user.id, req.user.username, 'vehicle_deleted', 'vehicle', req.params.id, (v.make||'') + ' ' + (v.model||''));
  res.json({ ok: true });
});

app.post('/api/vehicles/:id/sell', auth, async (req, res) => {
  const existing = await get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { salePrice, saleDate, sellingFees, buyer } = req.body;
  await run(`UPDATE vehicles SET sale_price=?, sale_date=?, selling_fees=?, buyer=?, status='sold', updated_at=datetime('now') WHERE id=?`,
    [salePrice || 0, saleDate || new Date().toISOString().slice(0,10), sellingFees || 0, buyer || '', req.params.id]);
  await logActivity(req.user.id, req.user.username, 'vehicle_sold', 'vehicle', req.params.id, (existing.make||'') + ' ' + (existing.model||''), JSON.stringify({ salePrice }));
  res.json(parseVehicle(await get('SELECT * FROM vehicles WHERE id = ?', [req.params.id])));
});

// ---- Photo upload ----
app.post('/api/vehicles/:id/photo', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const v = await get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    if (!v) return res.status(404).json({ error: 'Not found' });

    // Upload to Cloudinary
    const b64 = req.file.buffer.toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, { folder: 'g5auto', upload_preset: 'g5auto' });

    const photos = JSON.parse(v.photos || '[]');
    const url = result.secure_url;
    photos.push(url);
    await run("UPDATE vehicles SET photos=?, updated_at=datetime('now') WHERE id=?", [JSON.stringify(photos), req.params.id]);
    await logActivity(req.user.id, req.user.username, 'photo_uploaded', 'vehicle', req.params.id, (v.make||'') + ' ' + (v.model||''));
    res.json({ url, photos });
  } catch (err) {
    console.error('Photo upload error:', err.message || err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// ---- Expense routes ----
app.get('/api/expenses', auth, async (req, res) => {
  const rows = await all('SELECT * FROM expenses ORDER BY date DESC, created_at DESC', []);
  res.json(rows);
});

app.post('/api/expenses', auth, async (req, res) => {
  const id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { vehicleId, category, amount, date, description } = req.body;
  await run('INSERT INTO expenses (id, owner_id, vehicle_id, category, amount, date, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, vehicleId || null, category, amount || 0, date || new Date().toISOString().slice(0,10), description || '']);
  await logActivity(req.user.id, req.user.username, 'expense_added', 'expense', id, category, JSON.stringify({ amount, description }));
  res.json(await get('SELECT * FROM expenses WHERE id = ?', [id]));
});

app.delete('/api/expenses/:id', auth, async (req, res) => {
  const e = await get('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
  if (!e) return res.status(404).json({ error: 'Not found' });
  await run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  await logActivity(req.user.id, req.user.username, 'expense_deleted', 'expense', req.params.id, e.category);
  res.json({ ok: true });
});

// ---- Watchlist routes ----
app.get('/api/watchlist', auth, async (req, res) => {
  res.json(await all('SELECT * FROM watchlist ORDER BY created_at DESC', []));
});

app.post('/api/watchlist', auth, async (req, res) => {
  const id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { label, url, askingPrice, estimatedValue, estimatedProfit, seller, location, status } = req.body;
  await run('INSERT INTO watchlist (id, owner_id, label, url, asking_price, estimated_value, estimated_profit, seller, location, status, date_added) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, req.user.id, label||'', url||'', askingPrice||0, estimatedValue||0, estimatedProfit||0, seller||'', location||'', status||'Watching', new Date().toISOString().slice(0,10)]);
  await logActivity(req.user.id, req.user.username, 'watchlist_added', 'watchlist', id, label);
  res.json(await get('SELECT * FROM watchlist WHERE id = ?', [id]));
});

app.put('/api/watchlist/:id', auth, async (req, res) => {
  const w = await get('SELECT * FROM watchlist WHERE id = ?', [req.params.id]);
  if (!w) return res.status(404).json({ error: 'Not found' });
  const { label, url, askingPrice, estimatedValue, estimatedProfit, seller, location, status } = req.body;
  await run('UPDATE watchlist SET label=?, url=?, asking_price=?, estimated_value=?, estimated_profit=?, seller=?, location=?, status=? WHERE id=?',
    [label||w.label, url||w.url, askingPrice??w.asking_price, estimatedValue??w.estimated_value, estimatedProfit??w.estimated_profit, seller||w.seller, location||w.location, status||w.status, req.params.id]);
  res.json(await get('SELECT * FROM watchlist WHERE id = ?', [req.params.id]));
});

app.delete('/api/watchlist/:id', auth, async (req, res) => {
  await run('DELETE FROM watchlist WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ---- Activity log ----
app.get('/api/activity', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  res.json(await all('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?', [limit]));
});

app.get('/api/activity/all', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  res.json(await all('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?', [limit]));
});

// ---- Analytics ----
app.get('/api/analytics', auth, async (req, res) => {
  const totalVehicles = (await get('SELECT COUNT(*) as c FROM vehicles', [])).c;
  const totalSold = (await get("SELECT COUNT(*) as c FROM vehicles WHERE status='sold'", [])).c;
  const totalRevenue = (await get("SELECT COALESCE(SUM(sale_price),0) as s FROM vehicles WHERE status='sold'", [])).s;
  const totalInvested = (await get("SELECT COALESCE(SUM(purchase_price + repair_cost + parts_cost + labor_cost + transport_cost + auction_fees + dealer_fees + taxes + registration_cost + advertising_cost + detailing_cost + misc_cost + other_fees),0) as s FROM vehicles", [])).s;
  const totalExpenses = (await get("SELECT COALESCE(SUM(amount),0) as s FROM expenses", [])).s;
  const totalActions = (await get("SELECT COUNT(*) as c FROM activity_log", [])).c;
  const perUser = await all(`
    SELECT u.id, u.username, u.display_name,
      (SELECT COUNT(*) FROM activity_log WHERE user_id = u.id) as actions,
      (SELECT COUNT(*) FROM vehicles WHERE owner_id = u.id) as vehicles,
      (SELECT COUNT(*) FROM vehicles WHERE owner_id = u.id AND status='sold') as sold,
      (SELECT COALESCE(SUM(sale_price),0) FROM vehicles WHERE owner_id = u.id AND status='sold') as revenue,
      (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE owner_id = u.id) as expenses
    FROM users u ORDER BY actions DESC
  `);
  res.json({
    totalVehicles, totalSold, totalRevenue, totalInvested, totalExpenses, totalActions,
    profit: totalRevenue - totalInvested - totalExpenses,
    perUser
  });
});

// ---- SPA fallback ----
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- Business Expenses routes ----
app.get('/api/business-expenses', auth, async (req, res) => {
  try {
    res.json(await all('SELECT * FROM business_expenses ORDER BY date DESC, created_at DESC', []));
  } catch(e) { console.error('business-expenses GET error:', e); res.json([]); }
});

app.post('/api/business-expenses', auth, async (req, res) => {
  const id = 'be' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { category, amount, date, description, receipt } = req.body;
  await run('INSERT INTO business_expenses (id, owner_id, category, amount, date, description, receipt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, category, amount || 0, date || new Date().toISOString().slice(0,10), description || '', receipt || '']);
  await logActivity(req.user.id, req.user.username, 'business_expense_added', 'business_expense', id, category, JSON.stringify({ amount, description }));
  res.json(await get('SELECT * FROM business_expenses WHERE id = ?', [id]));
});

app.put('/api/business-expenses/:id', auth, async (req, res) => {
  const e = await get('SELECT * FROM business_expenses WHERE id = ?', [req.params.id]);
  if (!e) return res.status(404).json({ error: 'Not found' });
  const { category, amount, date, description, receipt } = req.body;
  await run('UPDATE business_expenses SET category=?, amount=?, date=?, description=?, receipt=? WHERE id=?',
    [category || e.category, amount ?? e.amount, date || e.date, description ?? e.description, receipt ?? e.receipt, req.params.id]);
  res.json(await get('SELECT * FROM business_expenses WHERE id = ?', [req.params.id]));
});

app.delete('/api/business-expenses/:id', auth, async (req, res) => {
  const e = await get('SELECT * FROM business_expenses WHERE id = ?', [req.params.id]);
  if (!e) return res.status(404).json({ error: 'Not found' });
  await run('DELETE FROM business_expenses WHERE id = ?', [req.params.id]);
  await logActivity(req.user.id, req.user.username, 'business_expense_deleted', 'business_expense', req.params.id, e.category);
  res.json({ ok: true });
});

// ---- Reset all data ----
app.post('/api/reset', auth, async (req, res) => {
  const { password } = req.body;
  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Wrong password' });
  await run('DELETE FROM vehicles', []);
  await run('DELETE FROM expenses', []);
  await run('DELETE FROM watchlist', []);
  await run('DELETE FROM activity_log', []);
  await run('DELETE FROM business_expenses', []);
  await logActivity(req.user.id, req.user.username, 'data_reset', 'user', req.user.id, req.user.username, 'All data cleared');
  res.json({ ok: true });
});

// Health check endpoint (used by UptimeRobot to keep server awake)
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// Debug: list accounts (remove in production)
app.get('/api/debug/accounts', async (req, res) => {
  const users = await all('SELECT id, username, display_name, must_change_password FROM users');
  res.json(users);
});

// ---- Helpers ----
function parseVehicle(row) {
  if (!row) return null;
  return {
    id: row.id, make: row.make||'', model: row.model||'', trim: row.trim||'', year: row.year,
    vin: row.vin||'', mileage: row.mileage, purchasePrice: row.purchase_price,
    purchaseDate: row.purchase_date, seller: row.seller||'', location: row.location||'',
    condition: row.condition_val||'Good', damage: row.damage||'', notes: row.notes||'',
    titleStatus: row.title_status||'clean', repairEstimate: row.repair_estimate,
    repairCost: row.repair_cost, partsCost: row.parts_cost, laborCost: row.labor_cost,
    transportCost: row.transport_cost, auctionFees: row.auction_fees,
    dealerFees: row.dealer_fees, taxes: row.taxes, registrationCost: row.registration_cost,
    advertisingCost: row.advertising_cost, detailingCost: row.detailing_cost,
    miscCost: row.misc_cost, otherFees: row.other_fees,
    photos: JSON.parse(row.photos || '[]'), status: row.status||'just_purchased',
    listPrice: row.list_price, listDate: row.list_date,
    salePrice: row.sale_price, saleDate: row.sale_date,
    buyer: row.buyer||'', sellingFees: row.selling_fees,
    timeline: JSON.parse(row.timeline || '[]'),
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function buildVehicleInsert(id, ownerId, data) {
  const map = { make:'make',model:'model',trim:'trim',year:'year',vin:'vin',mileage:'mileage',purchasePrice:'purchase_price',purchaseDate:'purchase_date',seller:'seller',location:'location',condition:'condition_val',damage:'damage',notes:'notes',titleStatus:'title_status',repairEstimate:'repair_estimate',repairCost:'repair_cost',partsCost:'parts_cost',laborCost:'labor_cost',transportCost:'transport_cost',auctionFees:'auction_fees',dealerFees:'dealer_fees',taxes:'taxes',registrationCost:'registration_cost',advertisingCost:'advertising_cost',detailingCost:'detailing_cost',miscCost:'misc_cost',otherFees:'other_fees',photos:'photos',status:'status',listPrice:'list_price',listDate:'list_date',salePrice:'sale_price',saleDate:'sale_date',buyer:'buyer',sellingFees:'selling_fees',timeline:'timeline' };
  const params = [id, ownerId];
  const cols = ['id','owner_id'];
  for (const [jsKey, dbKey] of Object.entries(map)) {
    if (data[jsKey] !== undefined) {
      cols.push(dbKey);
      let val = data[jsKey];
      if (jsKey === 'photos' || jsKey === 'timeline') val = JSON.stringify(val || []);
      params.push(val);
    }
  }
  const placeholders = cols.map(() => '?').join(',');
  return { sql: `INSERT INTO vehicles (${cols.join(',')}) VALUES (${placeholders})`, params };
}

function buildVehicleUpdate(id, data) {
  const map = { make:'make',model:'model',trim:'trim',year:'year',vin:'vin',mileage:'mileage',purchasePrice:'purchase_price',purchaseDate:'purchase_date',seller:'seller',location:'location',condition:'condition_val',damage:'damage',notes:'notes',titleStatus:'title_status',repairEstimate:'repair_estimate',repairCost:'repair_cost',partsCost:'parts_cost',laborCost:'labor_cost',transportCost:'transport_cost',auctionFees:'auction_fees',dealerFees:'dealer_fees',taxes:'taxes',registrationCost:'registration_cost',advertisingCost:'advertising_cost',detailingCost:'detailing_cost',miscCost:'misc_cost',otherFees:'other_fees',photos:'photos',status:'status',listPrice:'list_price',listDate:'list_date',salePrice:'sale_price',saleDate:'sale_date',buyer:'buyer',sellingFees:'selling_fees',timeline:'timeline' };
  const sets = ["updated_at=datetime('now')"];
  const params = [];
  for (const [jsKey, dbKey] of Object.entries(map)) {
    if (data[jsKey] !== undefined) {
      sets.push(`${dbKey}=?`);
      let val = data[jsKey];
      if (jsKey === 'photos' || jsKey === 'timeline') val = JSON.stringify(val || []);
      params.push(val);
    }
  }
  params.push(id);
  return { sql: `UPDATE vehicles SET ${sets.join(',')} WHERE id=?`, params };
}

// ---- Boot ----
(async () => {
  // Connect to Turso
  db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:g5auto.db',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  // Create tables in parallel for faster cold starts
  await Promise.all([
    db.execute(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      must_change_password INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.execute(`CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      make TEXT DEFAULT '', model TEXT DEFAULT '', trim TEXT DEFAULT '',
      year INTEGER, vin TEXT DEFAULT '', mileage INTEGER,
      purchase_price REAL DEFAULT 0, purchase_date TEXT,
      seller TEXT DEFAULT '', location TEXT DEFAULT '',
      condition_val TEXT DEFAULT 'Good', damage TEXT DEFAULT '', notes TEXT DEFAULT '',
      title_status TEXT DEFAULT 'clean', repair_estimate REAL DEFAULT 0,
      repair_cost REAL DEFAULT 0, parts_cost REAL DEFAULT 0, labor_cost REAL DEFAULT 0,
      transport_cost REAL DEFAULT 0, auction_fees REAL DEFAULT 0,
      dealer_fees REAL DEFAULT 0, taxes REAL DEFAULT 0,
      registration_cost REAL DEFAULT 0, advertising_cost REAL DEFAULT 0,
      detailing_cost REAL DEFAULT 0, misc_cost REAL DEFAULT 0, other_fees REAL DEFAULT 0,
      photos TEXT DEFAULT '[]', status TEXT DEFAULT 'just_purchased',
      list_price REAL, list_date TEXT,
      sale_price REAL DEFAULT 0, sale_date TEXT,
      buyer TEXT DEFAULT '', selling_fees REAL DEFAULT 0,
      timeline TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`),
    db.execute(`CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      vehicle_id TEXT,
      category TEXT NOT NULL,
      amount REAL DEFAULT 0, date TEXT,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.execute(`CREATE TABLE IF NOT EXISTS watchlist (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      label TEXT DEFAULT '', url TEXT DEFAULT '',
      asking_price REAL DEFAULT 0, estimated_value REAL DEFAULT 0,
      estimated_profit REAL DEFAULT 0, seller TEXT DEFAULT '',
      location TEXT DEFAULT '', status TEXT DEFAULT 'Watching',
      date_added TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.execute(`CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT, entity_id TEXT, entity_name TEXT,
      details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.execute(`CREATE TABLE IF NOT EXISTS business_expenses (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount REAL DEFAULT 0,
      date TEXT,
      description TEXT DEFAULT '',
      receipt TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  ]);

  // Seed default accounts (password: 1234, must change on first login)
  const seedHash = bcrypt.hashSync('1234', 10);
  const seedAccounts = [
    { username: 'shahab', displayName: 'Shahab' },
    { username: 'omar', displayName: 'Omar' },
    { username: 'neamat', displayName: 'Neamat' },
    { username: 'wahaid', displayName: 'Wahaid' }
  ];
  for (const a of seedAccounts) {
    const existing = await get('SELECT id FROM users WHERE username = ?', [a.username]);
    if (!existing) {
      await run('INSERT INTO users (username, password_hash, display_name, must_change_password) VALUES (?, ?, ?, 1)',
        [a.username, seedHash, a.displayName]);
    }
  }

  app.listen(PORT, () => {
    console.log(`\n  G4 Auto server running at http://localhost:${PORT}\n`);
  });
})();
