const db = require('./database');

const addColumnIfMissing = (tableName, columnName, definition) => {
  db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
    if (err) {
      console.error(`Error checking ${tableName} schema:`, err);
      return;
    }

    const exists = columns.some((column) => column.name === columnName);
    if (!exists) {
      db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`, (alterErr) => {
        if (alterErr) {
          console.error(`Error adding ${columnName} to ${tableName}:`, alterErr);
        }
      });
    }
  });
};

// Create tables
const createTables = () => {
  db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Buildings table
  db.run(`
    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      country TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Units table
  db.run(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL,
      unit_number TEXT NOT NULL,
      unit_type TEXT,
      monthly_rent DECIMAL(10, 2),
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (building_id) REFERENCES buildings(id)
    )
  `);

  // Tenants table
  db.run(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      national_id TEXT,
      unit_id TEXT,
      move_in_date DATE,
      move_out_date DATE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (unit_id) REFERENCES units(id)
    )
  `);

  // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_period TEXT,
      payment_status TEXT DEFAULT 'confirmed',
      payment_method TEXT,
      receipt_path TEXT,
      approval_notes TEXT,
      approved_by TEXT,
      approved_at DATETIME,
      rejection_reason TEXT,
      rejected_by TEXT,
      rejected_at DATETIME,
      verification_code TEXT,
      receipt_printed INTEGER DEFAULT 0,
      receipt_printed_at DATETIME,
      receipt_print_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    )
  `);

  // Balances table
  db.run(`
    CREATE TABLE IF NOT EXISTS balances (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      total_owed DECIMAL(10, 2) DEFAULT 0,
      total_paid DECIMAL(10, 2) DEFAULT 0,
      balance DECIMAL(10, 2) DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    )
  `);

  // Contracts table
  db.run(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      contract_start DATE NOT NULL,
      contract_end DATE NOT NULL,
      status TEXT DEFAULT 'active',
      contract_file_path TEXT,
      notes TEXT,
      terminated_at DATETIME,
      termination_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    )
  `);

  // WhatsApp reminder logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_reminder_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      phone TEXT,
      due_period TEXT,
      reminder_date DATE,
      status TEXT,
      response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, due_period, reminder_date),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);

  // Expenses table
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'Utilities',
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'paid',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Team chat messages table
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Calendar planning events table
  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start DATETIME NOT NULL,
      end DATETIME,
      category TEXT DEFAULT 'Other',
      note TEXT,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Open',
      reminder_lead TEXT DEFAULT 'same-day',
      action_path TEXT,
      action_label TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tenant_rent_history (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      start_period TEXT NOT NULL,
      end_period TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      role TEXT,
      action TEXT NOT NULL,
      method TEXT,
      path TEXT,
      status_code INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tenant_portal_accounts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tenant_portal_messages (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_user_id TEXT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_by_tenant INTEGER DEFAULT 0,
      read_by_admin INTEGER DEFAULT 0,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (sender_user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_tenant_portal_messages_tenant_created
    ON tenant_portal_messages(tenant_id, created_at)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_sessions_expired_at
    ON sessions(expired_at)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tenant_followups (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      unit_id TEXT,
      payment_period TEXT,
      action_type TEXT NOT NULL,
      note TEXT,
      promise_date DATE,
      status TEXT DEFAULT 'open',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (unit_id) REFERENCES units(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  console.log('✅ Database tables created successfully');

  addColumnIfMissing('payments', 'payment_period', 'TEXT');
  addColumnIfMissing('payments', 'payment_status', "TEXT DEFAULT 'confirmed'");
  addColumnIfMissing('payments', 'approval_notes', 'TEXT');
  addColumnIfMissing('payments', 'approved_by', 'TEXT');
  addColumnIfMissing('payments', 'approved_at', 'DATETIME');
  addColumnIfMissing('payments', 'rejection_reason', 'TEXT');
  addColumnIfMissing('payments', 'rejected_by', 'TEXT');
  addColumnIfMissing('payments', 'rejected_at', 'DATETIME');
  addColumnIfMissing('payments', 'verification_code', 'TEXT');
  addColumnIfMissing('payments', 'receipt_printed', 'INTEGER DEFAULT 0');
  addColumnIfMissing('payments', 'receipt_printed_at', 'DATETIME');
  addColumnIfMissing('payments', 'receipt_print_count', 'INTEGER DEFAULT 0');
  db.run(`
    UPDATE payments
    SET verification_code = 'UB-' || upper(substr(replace(id, '-', ''), 1, 10))
    WHERE verification_code IS NULL OR verification_code = ''
  `);
  addColumnIfMissing('buildings', 'total_floors', 'INTEGER DEFAULT 1');
  addColumnIfMissing('buildings', 'available_floors', 'TEXT');
  addColumnIfMissing('units', 'floor', 'TEXT DEFAULT "GROUND FLOOR"');
  db.run(`
    INSERT INTO tenant_rent_history (id, tenant_id, unit_id, amount, start_period, end_period)
    SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
           t.id,
           t.unit_id,
           COALESCE(u.monthly_rent, 0),
           COALESCE(substr(t.move_in_date, 1, 7), substr(t.created_at, 1, 7), strftime('%Y-%m', 'now')),
           NULL
    FROM tenants t
    LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.unit_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM tenant_rent_history rh
        WHERE rh.tenant_id = t.id AND rh.unit_id = t.unit_id
      )
  `);
  });
};

createTables();

// Create default admin user if not exists
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const createDefaultUser = () => {
  const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'admin123');
  const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';

  if (!defaultPassword) {
    console.error('DEFAULT_ADMIN_PASSWORD is required when NODE_ENV=production.');
    return;
  }
  
  // Check if admin user exists
  db.get('SELECT * FROM users WHERE username = ?', [defaultUsername], (err, user) => {
    if (err) {
      console.error('Error checking for default user:', err);
      return;
    }
    
    if (!user) {
      const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
      const userId = uuidv4();
      
      db.run(
        'INSERT INTO users (id, username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, defaultUsername, defaultEmail, hashedPassword, 'Administrator', 'admin'],
        (insertErr) => {
          if (insertErr) {
            console.error('Error creating default admin user:', insertErr);
          } else {
            console.log('✅ Default admin user created');
            console.log(`   Username: ${defaultUsername}`);
            console.log(`   Email: ${defaultEmail}`);
          }
        }
      );
    } else {
      console.log('✅ Admin user already exists');
    }
  });
};

// Wait a moment for tables to be created, then create default user
setTimeout(createDefaultUser, 1000);

// Add role column to existing users table
addColumnIfMissing('users', 'role', "TEXT DEFAULT 'user'");
addColumnIfMissing('users', 'profile_image', 'TEXT');
addColumnIfMissing('users', 'email_verified', 'INTEGER DEFAULT 0');
addColumnIfMissing('users', 'verification_token', 'TEXT');
addColumnIfMissing('users', 'verification_token_expires', 'DATETIME');
addColumnIfMissing('users', 'phone', 'TEXT');
addColumnIfMissing('users', 'reset_token', 'TEXT');
addColumnIfMissing('users', 'reset_token_expires', 'DATETIME');
addColumnIfMissing('users', 'reset_otp', 'TEXT');
addColumnIfMissing('users', 'reset_otp_expires', 'DATETIME');
addColumnIfMissing('users', 'login_otp', 'TEXT');
addColumnIfMissing('users', 'login_otp_expires', 'DATETIME');
addColumnIfMissing('users', 'is_active', 'INTEGER DEFAULT 1');
addColumnIfMissing('tenants', 'identification_document', 'TEXT');
addColumnIfMissing('tenants', 'address', 'TEXT');
addColumnIfMissing('tenants', 'occupation_status', 'TEXT');
addColumnIfMissing('tenants', 'occupation_place', 'TEXT');
addColumnIfMissing('tenants', 'emergency_contact_name', 'TEXT');
addColumnIfMissing('tenants', 'emergency_contact_phone', 'TEXT');
addColumnIfMissing('chat_messages', 'receiver_id', "TEXT DEFAULT 'ROOM_GLOBAL'");
addColumnIfMissing('chat_messages', 'priority', "TEXT DEFAULT 'normal'");
addColumnIfMissing('chat_messages', 'message_type', "TEXT DEFAULT 'text'");
addColumnIfMissing('chat_messages', 'is_pinned', 'INTEGER DEFAULT 0');
addColumnIfMissing('calendar_events', 'start', 'DATETIME');
addColumnIfMissing('calendar_events', 'end', 'DATETIME');
addColumnIfMissing('calendar_events', 'category', "TEXT DEFAULT 'Other'");
addColumnIfMissing('calendar_events', 'note', 'TEXT');
addColumnIfMissing('calendar_events', 'priority', "TEXT DEFAULT 'Medium'");
addColumnIfMissing('calendar_events', 'status', "TEXT DEFAULT 'Open'");
addColumnIfMissing('calendar_events', 'reminder_lead', "TEXT DEFAULT 'same-day'");
addColumnIfMissing('calendar_events', 'action_path', 'TEXT');
addColumnIfMissing('calendar_events', 'action_label', 'TEXT');
addColumnIfMissing('calendar_events', 'created_by', 'TEXT');
addColumnIfMissing('tenant_followups', 'unit_id', 'TEXT');
addColumnIfMissing('tenant_followups', 'payment_period', 'TEXT');
addColumnIfMissing('tenant_followups', 'promise_date', 'DATE');
addColumnIfMissing('tenant_followups', 'status', "TEXT DEFAULT 'open'");
addColumnIfMissing('tenant_followups', 'created_by', 'TEXT');

setTimeout(() => {
  db.all('PRAGMA table_info(calendar_events)', [], (schemaErr, columns = []) => {
    if (schemaErr) {
      console.error('Error checking calendar event schema:', schemaErr);
      return;
    }

    const columnNames = new Set(columns.map((column) => column.name));
    const firstAvailable = (...names) => names.find((name) => columnNames.has(name));
    const startFallback = firstAvailable('start_date', 'created_at');
    const endFallback = firstAvailable('end_date', 'start_date', 'created_at');
    const categoryFallback = firstAvailable('event_type');
    const noteFallback = firstAvailable('description');
    const createdByFallback = firstAvailable('user_id');

    db.run(`
      UPDATE calendar_events
      SET start = COALESCE(start${startFallback ? `, ${startFallback}` : ''}, created_at),
          end = COALESCE(end${endFallback ? `, ${endFallback}` : ''}, start, created_at),
          category = COALESCE(category${categoryFallback ? `, ${categoryFallback}` : ''}, 'Other'),
          note = COALESCE(note${noteFallback ? `, ${noteFallback}` : ''}, ''),
          priority = COALESCE(priority, 'Medium'),
          status = COALESCE(status, 'Open'),
          reminder_lead = COALESCE(reminder_lead, 'same-day'),
          created_by = ${createdByFallback ? `COALESCE(created_by, ${createdByFallback})` : 'created_by'}
    `, (err) => {
    if (err) {
      console.error('Error migrating calendar events:', err);
    }
  });
  });
}, 1200);

setTimeout(() => {
  db.run(
    "UPDATE users SET email_verified = 1 WHERE role = 'admin'",
    (err) => {
      if (err) {
        console.error('Error marking admin users as verified:', err);
      }
    }
  );
}, 1500);

console.log('Database migration completed successfully');

// Cleanup orphaned records left from historical deletes before cascade handling was added.
setTimeout(() => {
  const legacyFullFloorPreset = JSON.stringify([
    'BASEMENT 3',
    'B2',
    'B1',
    'BF',
    'GROUND FLOOR',
    '1ST FLOOR',
    '2ND FLOOR',
    '3RD FLOOR',
    'FLOOR A',
    'FLOOR B',
    'FLOOR C',
    'CONT'
  ]);

  db.run(
    `UPDATE buildings
     SET available_floors = '[]',
         updated_at = CURRENT_TIMESTAMP
     WHERE COALESCE(total_floors, 1) <= 1
       AND COALESCE(available_floors, '') = ?`,
    [legacyFullFloorPreset],
    (legacyFloorCleanupErr) => {
      if (legacyFloorCleanupErr) {
        console.error('Error cleaning legacy building floor presets:', legacyFloorCleanupErr);
      }
    }
  );

  db.run(
    `UPDATE units
     SET status = CASE
       WHEN EXISTS (
         SELECT 1
         FROM tenants t
         WHERE t.unit_id = units.id
           AND t.status = 'active'
           AND (t.move_in_date IS NULL OR DATE(t.move_in_date) <= DATE('now'))
           AND (t.move_out_date IS NULL OR DATE(t.move_out_date) > DATE('now'))
       ) THEN 'occupied'
       WHEN COALESCE(units.status, 'available') = 'maintenance' THEN 'maintenance'
       ELSE 'available'
     END,
     updated_at = CURRENT_TIMESTAMP`
  );

  db.run(
    `DELETE FROM payments
     WHERE tenant_id NOT IN (SELECT id FROM tenants)
        OR unit_id NOT IN (SELECT id FROM units)`,
    (paymentCleanupErr) => {
      if (paymentCleanupErr) {
        console.error('Error cleaning orphan payments:', paymentCleanupErr);
      }
    }
  );

  db.run(
    `DELETE FROM balances
     WHERE tenant_id NOT IN (SELECT id FROM tenants)
        OR unit_id NOT IN (SELECT id FROM units)`,
    (balanceCleanupErr) => {
      if (balanceCleanupErr) {
        console.error('Error cleaning orphan balances:', balanceCleanupErr);
      }
    }
  );
}, 800);

// Error handling
db.on('error', (err) => {
  console.error('Database error:', err);
});

process.on('SIGINT', () => {
  db.close(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
});
