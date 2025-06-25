
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DB_FILE_NAME = 'dhalugueis.db';
const dataDirectory = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDirectory, DB_FILE_NAME);
const oldDbPath = path.join(process.cwd(), DB_FILE_NAME);

let dbInstance: Database.Database | null = null;

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  // Auto-migration for existing database file in root
  if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
    console.log(`[DB Migration] Found legacy database at ${oldDbPath}.`);
    if (!fs.existsSync(dataDirectory)) {
        fs.mkdirSync(dataDirectory, { recursive: true });
        console.log(`[DB Migration] Created new data directory at ${dataDirectory}.`);
    }
    fs.renameSync(oldDbPath, dbPath);
    console.log(`[DB Migration] Successfully moved database to ${dbPath}.`);
  } else {
    // Ensure data directory exists for new setups
    if (!fs.existsSync(dataDirectory)) {
      fs.mkdirSync(dataDirectory, { recursive: true });
      console.log(`[DB] Created data directory at ${dataDirectory}.`);
    }
  }

  console.log(`[DB] Path for database file: ${dbPath}`);
  
  try {
    dbInstance = new Database(dbPath, { verbose: console.log }); 
    console.log(`[DB] Database connection established at ${dbPath}.`);
  } catch (error) {
    console.error(`[DB] CRITICAL ERROR initializing database at ${dbPath}:`, error);
    throw error; 
  }
  
  // The WAL pragma was removed as it can cause "disk I/O error" in some
  // containerized or network filesystem environments. The default journal
  // mode is more compatible.

  try {
    dbInstance.pragma('foreign_keys = ON');
    console.log("[DB] PRAGMA foreign_keys set to ON.");
  } catch (fkError) {
    console.warn(`[DB] WARNING: Failed to set PRAGMA foreign_keys = ON. Error: ${(fkError as Error).message}`);
  }

  console.log("[DB] Initializing database schema...");
  initializeSchema(dbInstance);
  console.log("[DB] Database schema initialized/verified.");

  return dbInstance;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      passwordSalt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT, 
      cpf TEXT, 
      imageUrl TEXT,
      responsiveness TEXT CHECK(responsiveness IN ('very responsive', 'responsive', 'not very responsive', 'never responds')) NOT NULL,
      rentalHistory TEXT CHECK(rentalHistory IN ('always on time', 'sometimes late', 'often late', 'always late')) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS equipment_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        iconName TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        typeId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT CHECK(status IN ('available', 'rented')) NOT NULL,
        imageUrl TEXT,
        dailyRentalRate REAL NOT NULL,
        FOREIGN KEY (typeId) REFERENCES equipment_types(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS rentals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        customerId TEXT NOT NULL,
        customerName TEXT,
        rentalStartDate TEXT NOT NULL,
        rentalDays INTEGER NOT NULL,
        expectedReturnDate TEXT NOT NULL,
        actualReturnDate TEXT,
        freightValue REAL DEFAULT 0,
        discountValue REAL DEFAULT 0,
        value REAL NOT NULL,
        paymentStatus TEXT CHECK(paymentStatus IN ('paid', 'pending', 'overdue')) NOT NULL,
        paymentMethod TEXT CHECK(paymentMethod IN ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'nao_definido')),
        paymentDate TEXT,
        notes TEXT,
        deliveryAddress TEXT,
        isOpenEnded INTEGER DEFAULT 0,
        chargeSaturdays INTEGER DEFAULT 1,
        chargeSundays INTEGER DEFAULT 1,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS rental_equipment (
        rentalId INTEGER NOT NULL, 
        equipmentId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        name TEXT, 
        customDailyRentalRate REAL,
        PRIMARY KEY (rentalId, equipmentId),
        FOREIGN KEY (rentalId) REFERENCES rentals(id) ON DELETE CASCADE,
        FOREIGN KEY (equipmentId) REFERENCES inventory(id) ON DELETE RESTRICT
    );
    
    CREATE TABLE IF NOT EXISTS expense_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        iconName TEXT 
    );

    CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        categoryId TEXT NOT NULL,
        FOREIGN KEY (categoryId) REFERENCES expense_categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS company_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS rental_photos (
      id TEXT PRIMARY KEY,
      rentalId INTEGER NOT NULL,
      imageUrl TEXT NOT NULL,
      photoType TEXT NOT NULL CHECK(photoType IN ('delivery', 'return')),
      uploadedAt TEXT NOT NULL,
      FOREIGN KEY (rentalId) REFERENCES rentals(id) ON DELETE CASCADE
    );
  `);
  
  const equipTypesStmt = db.prepare('SELECT COUNT(*) as count FROM equipment_types');
  const equipTypesResult = equipTypesStmt.get() as { count: number };
  if (equipTypesResult.count === 0) {
    console.log("[DB] No equipment types found. Creating default types...");
    const insert = db.prepare('INSERT INTO equipment_types (id, name, iconName) VALUES (?, ?, ?)');
    const initialTypes = [
      { id: 'type_scaffolding', name: 'Andaime', iconName: 'Building2' },
      { id: 'type_shoring', name: 'Escora', iconName: 'Construction' },
      { id: 'type_platforms', name: 'Plataforma', iconName: 'LayoutPanelTop' },
      { id: 'type_other', name: 'Outro', iconName: 'Package'}
    ];
    const insertManyTypes = db.transaction((types) => {
      for (const type of types) insert.run(type.id, type.name, type.iconName);
    });
    insertManyTypes(initialTypes);
    console.log("[DB] Default equipment types created.");
  }

  const expenseCategoriesStmt = db.prepare('SELECT COUNT(*) as count FROM expense_categories');
  const expenseCategoriesResult = expenseCategoriesStmt.get() as { count: number };
  if (expenseCategoriesResult.count === 0) {
    console.log("[DB] No expense categories found. Creating default categories...");
    const insert = db.prepare('INSERT INTO expense_categories (id, name, iconName) VALUES (?, ?, ?)');
    const initialCategories = [
      { id: `expcat_maintenance_${crypto.randomBytes(3).toString('hex')}`, name: 'Manutenção Frota', iconName: 'Wrench' },
      { id: `expcat_fuel_${crypto.randomBytes(3).toString('hex')}`, name: 'Combustível', iconName: 'Fuel' }, 
      { id: `expcat_operational_${crypto.randomBytes(3).toString('hex')}`, name: 'Despesas Operacionais', iconName: 'Settings' },
      { id: `expcat_marketing_${crypto.randomBytes(3).toString('hex')}`, name: 'Marketing e Publicidade', iconName: 'Megaphone' },
      { id: `expcat_general_${crypto.randomBytes(3).toString('hex')}`, name: 'Despesas Gerais', iconName: 'DollarSign' }, 
      { id: `expcat_other_${crypto.randomBytes(3).toString('hex')}`, name: 'Outro', iconName: 'HelpCircle' },
    ];
    const insertManyCategories = db.transaction((categories) => {
      for (const cat of categories) insert.run(cat.id, cat.name, cat.iconName);
    });
    insertManyCategories(initialCategories);
    console.log("[DB] Default expense categories created.");
  }

  // Seed company settings if they don't exist
  const settingsCountStmt = db.prepare('SELECT COUNT(*) as count FROM company_settings');
  const settingsCount = settingsCountStmt.get() as { count: number };
  if (settingsCount.count === 0) {
    console.log("[DB] Company settings not found. Seeding default settings...");
    const insertStmt = db.prepare('INSERT OR REPLACE INTO company_settings (key, value) VALUES (@key, @value)');
    const insertMany = db.transaction((settings) => {
      for (const key in settings) {
        insertStmt.run({ key, value: settings[key as keyof typeof settings] });
      }
    });

    const defaultSettings = {
      companyName: 'DH Alugueis',
      responsibleName: 'Delano Holanda',
      phone: '88982248384',
      address: 'Rua Ana Ventura de Oliveira, 189, Ipu, CE',
      email: 'dhalugueis@gmail.com',
      pixKey: '+5588982248384',
      contractTermsAndConditions: `1. O locatário é responsável por quaisquer danos, perda ou roubo do equipamento alugado.
2. O equipamento deve ser devolvido na data e hora especificadas no contrato. Atrasos podem incorrer em taxas adicionais.
3. O pagamento deve ser efetuado conforme acordado. Em caso de inadimplência, medidas legais poderão ser tomadas.
4. A DH Aluguéis não se responsabiliza por acidentes ou danos causados pelo uso inadequado do equipamento.
5. Este documento não tem valor fiscal. Solicite sua nota fiscal, se necessário.`,
      contractFooterText: 'Obrigado por escolher a DH Aluguéis!',
      companyLogoUrl: '',
      contractLogoUrl: '',
    };
    insertMany(defaultSettings);
    console.log("[DB] Default company settings have been seeded.");
  }

  // --- Admin User Seeding ---
  const usersStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const usersResult = usersStmt.get() as { count: number };
  if (usersResult.count === 0) {
    console.log("[DB] No users found. Creating default admin user...");
    const defaultUserId = `user_${crypto.randomBytes(8).toString('hex')}`;
    const defaultPassword = 'dhdh1234'; 
    const { salt, hash } = hashPassword(defaultPassword);
    
    const insertUserStmt = db.prepare('INSERT INTO users (id, name, email, passwordHash, passwordSalt) VALUES (@id, @name, @email, @passwordHash, @passwordSalt)');
    insertUserStmt.run({
      id: defaultUserId,
      name: 'DH Alugueis Admin',
      email: 'admin@dhalugueis.com', 
      passwordHash: hash,
      passwordSalt: salt,
    });
    console.log(`[DB] Default admin user created successfully. Email: admin@dhalugueis.com, Password: ${defaultPassword}.`);
  }
}
