
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DB_FILE_NAME = 'dhalugueis.db';
const dataDirectory = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDirectory, DB_FILE_NAME);

// --- Start of Singleton Pattern ---
// This will hold the single, persistent database instance.
// Using a global symbol ensures this is truly a singleton in Next.js dev environment.
const symbolForDb = Symbol.for('dhalugueis.db.instance');

interface GlobalWithDb {
  [symbolForDb]?: Database.Database;
}

const globalWithDb = global as GlobalWithDb;
// --- End of Singleton Pattern ---


function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function runMigrations(db: Database.Database) {
    console.log("[DB Migration] Checking for necessary schema migrations...");

    try {
        const columns = db.pragma('table_info(rentals)') as { name: string }[];
        const hasFuelValue = columns.some(col => col.name === 'fuelValue');
        const hasFullTank = columns.some(col => col.name === 'deliveredWithFullTank');
        
        if (!hasFuelValue) {
            console.log("[DB Migration] Applying migration: Adding 'fuelValue' column to 'rentals' table.");
            db.exec('ALTER TABLE rentals ADD COLUMN fuelValue REAL DEFAULT 0');
        }
        if (!hasFullTank) {
            console.log("[DB Migration] Applying migration: Adding 'deliveredWithFullTank' column to 'rentals' table.");
            db.exec('ALTER TABLE rentals ADD COLUMN deliveredWithFullTank INTEGER DEFAULT 0');
        }

    } catch (error) {
        console.error("[DB Migration] Error during fuel columns check/add:", error);
    }


    // Migration for returnNotificationSent column in rentals table
    try {
        const columns = db.pragma('table_info(rentals)') as { name: string }[];
        const hasNotificationColumn = columns.some(col => col.name === 'returnNotificationSent');

        if (!hasNotificationColumn) {
            console.log("[DB Migration] Applying migration: Adding 'returnNotificationSent' column to 'rentals' table.");
            db.exec('ALTER TABLE rentals ADD COLUMN returnNotificationSent TEXT');
            console.log("[DB Migration] 'returnNotificationSent' column added successfully.");
        }
    } catch (error) {
        console.error("[DB Migration] Error during 'returnNotificationSent' column check/add:", error);
    }
    
    // Migration for notification_logs table
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS notification_logs (
                id TEXT PRIMARY KEY,
                sentAt TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'no_reminders_needed')),
                recipient TEXT,
                subject TEXT,
                errorDetails TEXT,
                triggerType TEXT NOT NULL CHECK(triggerType IN ('automatic', 'manual'))
            );
        `);
        console.log("[DB Migration] Ensured 'notification_logs' table exists.");
    } catch (error) {
        console.error("[DB Migration] Error ensuring 'notification_logs' table exists:", error);
    }

    // Migration for CNPJ/CPF columns in customers table
    try {
        const columns = db.pragma('table_info(customers)') as { name: string }[];
        const hasDocumentTypeColumn = columns.some(col => col.name === 'documentType');
        const hasDocumentNumberColumn = columns.some(col => col.name === 'documentNumber');

        if (!hasDocumentTypeColumn || !hasDocumentNumberColumn) {
            if (!hasDocumentTypeColumn) {
              db.exec(`ALTER TABLE customers ADD COLUMN documentType TEXT CHECK(documentType IN ('cpf', 'cnpj')) DEFAULT 'cpf';`);
            }
            if (!hasDocumentNumberColumn) {
               db.exec(`ALTER TABLE customers ADD COLUMN documentNumber TEXT;`);
            }
            console.log("[DB Migration] New document columns added.");
        }
    } catch (error) {
        console.error("[DB Migration] Error during document columns check/add:", error);
    }

    // Migration for payments table
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                rentalId INTEGER NOT NULL,
                amount REAL NOT NULL,
                paymentDate TEXT NOT NULL,
                paymentMethod TEXT NOT NULL,
                isPartial INTEGER DEFAULT 0,
                FOREIGN KEY (rentalId) REFERENCES rentals(id) ON DELETE CASCADE
            );
        `);
        console.log("[DB Migration] Ensured 'payments' table exists.");
    } catch (error) {
        console.error("[DB Migration] Error ensuring 'payments' table exists:", error);
    }

    // Migration for quotes tables
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customerId TEXT NOT NULL,
                customerName TEXT,
                quoteDate TEXT NOT NULL,
                rentalStartDate TEXT,
                rentalDays INTEGER,
                expectedReturnDate TEXT,
                freightValue REAL,
                discountValue REAL,
                value REAL,
                notes TEXT,
                deliveryAddress TEXT,
                chargeSaturdays INTEGER DEFAULT 1,
                chargeSundays INTEGER DEFAULT 1,
                status TEXT DEFAULT 'pending',
                FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT
            );
        `);
        console.log("[DB Migration] Ensured 'quotes' table exists.");
        db.exec(`
            CREATE TABLE IF NOT EXISTS quote_equipment (
                quoteId INTEGER NOT NULL,
                equipmentId TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                name TEXT,
                customDailyRentalRate REAL,
                PRIMARY KEY (quoteId, equipmentId),
                FOREIGN KEY (quoteId) REFERENCES quotes(id) ON DELETE CASCADE,
                FOREIGN KEY (equipmentId) REFERENCES inventory(id) ON DELETE RESTRICT
            );
        `);
        console.log("[DB Migration] Ensured 'quote_equipment' table exists.");
    } catch(error) {
        console.error("[DB Migration] Error ensuring 'quotes' or 'quote_equipment' tables exist:", error);
    }

    // Migration for rental_equipment table to add customDailyRentalRate
    try {
        const rentalEquipmentCols = db.pragma('table_info(rental_equipment)') as { name: string }[];
        if (!rentalEquipmentCols.some(col => col.name === 'customDailyRentalRate')) {
            console.log("[DB Migration] Applying migration: Adding 'customDailyRentalRate' column to 'rental_equipment' table.");
            db.exec('ALTER TABLE rental_equipment ADD COLUMN customDailyRentalRate REAL');
            console.log("[DB Migration] 'customDailyRentalRate' column added successfully to rental_equipment.");
        }
    } catch (error) {
         console.error("[DB Migration] Error during 'customDailyRentalRate' column check/add for rental_equipment:", error);
    }
    
    console.log("[DB Migration] Schema check complete.");
}

function initializeDb() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    console.log(`[DB] Created data directory at ${dataDirectory}.`);
  }
  
  const dbExists = fs.existsSync(dbPath);
  console.log(`[DB] Path for database file: ${dbPath}`);
  
  try {
    const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined }); 
    console.log(`[DB] Database connection established at ${dbPath}.`);
    
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log("[DB] PRAGMA journal_mode set to WAL and foreign_keys set to ON.");

    if (!dbExists) {
      console.log("[DB] New database file detected. Initializing schema and seeding default data...");
      initializeSchemaAndSeed(db);
      console.log("[DB] Database schema and default data initialized.");
    } else {
      console.log("[DB] Existing database file found. Running migrations if needed.");
      runMigrations(db);
    }
    
    // Only attach the exit handler once
    if (process.env.NODE_ENV !== 'production' || !globalWithDb[symbolForDb]) {
        process.on('exit', () => {
            if(db && db.open) {
                console.log('[DB] Closing database connection on process exit.');
                db.close();
            }
        });
    }

    return db;

  } catch (error) {
    console.error(`[DB] CRITICAL ERROR initializing database at ${dbPath}:`, error);
    throw error; 
  }
}

export function getDb() {
    if (process.env.NODE_ENV === 'production') {
        if (!globalWithDb[symbolForDb]) {
            globalWithDb[symbolForDb] = initializeDb();
        }
        return globalWithDb[symbolForDb]!;
    } else {
        // In development, Next.js clears the require cache on every request,
        // so we need to constantly check if the global instance exists.
        if (!globalWithDb[symbolForDb]) {
            globalWithDb[symbolForDb] = initializeDb();
        }
        return globalWithDb[symbolForDb]!;
    }
}

function initializeSchemaAndSeed(db: Database.Database) {
  // --- SCHEMA CREATION ---
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
      documentType TEXT CHECK(documentType IN ('cpf', 'cnpj')) DEFAULT 'cpf',
      documentNumber TEXT,
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
        fuelValue REAL DEFAULT 0,
        deliveredWithFullTank INTEGER DEFAULT 0,
        value REAL NOT NULL,
        paymentStatus TEXT CHECK(paymentStatus IN ('paid', 'pending', 'overdue')) NOT NULL,
        paymentMethod TEXT CHECK(paymentMethod IN ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'nao_definido')),
        paymentDate TEXT,
        notes TEXT,
        deliveryAddress TEXT,
        isOpenEnded INTEGER DEFAULT 0,
        chargeSaturdays INTEGER DEFAULT 1,
        chargeSundays INTEGER DEFAULT 1,
        returnNotificationSent TEXT,
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

    CREATE TABLE IF NOT EXISTS notification_logs (
        id TEXT PRIMARY KEY,
        sentAt TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'no_reminders_needed')),
        recipient TEXT,
        subject TEXT,
        errorDetails TEXT,
        triggerType TEXT NOT NULL CHECK(triggerType IN ('automatic', 'manual'))
    );

    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        rentalId INTEGER NOT NULL,
        amount REAL NOT NULL,
        paymentDate TEXT NOT NULL,
        paymentMethod TEXT NOT NULL,
        isPartial INTEGER DEFAULT 0,
        FOREIGN KEY (rentalId) REFERENCES rentals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId TEXT NOT NULL,
        customerName TEXT,
        quoteDate TEXT NOT NULL,
        rentalStartDate TEXT,
        rentalDays INTEGER,
        expectedReturnDate TEXT,
        freightValue REAL,
        discountValue REAL,
        value REAL,
        notes TEXT,
        deliveryAddress TEXT,
        chargeSaturdays INTEGER DEFAULT 1,
        chargeSundays INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS quote_equipment (
        quoteId INTEGER NOT NULL,
        equipmentId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        name TEXT,
        customDailyRentalRate REAL,
        PRIMARY KEY (quoteId, equipmentId),
        FOREIGN KEY (quoteId) REFERENCES quotes(id) ON DELETE CASCADE,
        FOREIGN KEY (equipmentId) REFERENCES inventory(id) ON DELETE RESTRICT
    );
  `);
  
  // --- DEFAULT DATA SEEDING ---
  
  // Seed default equipment types
  console.log("[DB] Seeding default equipment types...");
  const insertEquipTypes = db.prepare('INSERT INTO equipment_types (id, name, iconName) VALUES (?, ?, ?)');
  const initialTypes = [
    { id: 'type_scaffolding', name: 'Andaime', iconName: 'Building2' },
    { id: 'type_shoring', name: 'Escora', iconName: 'Construction' },
    { id: 'type_platforms', name: 'Plataforma', iconName: 'LayoutPanelTop' },
    { id: 'type_other', name: 'Outro', iconName: 'Package'}
  ];
  const insertManyTypes = db.transaction((types) => {
    for (const type of types) insertEquipTypes.run(type.id, type.name, type.iconName);
  });
  insertManyTypes(initialTypes);
  console.log("[DB] Default equipment types seeded.");

  // Seed default expense categories
  console.log("[DB] Seeding default expense categories...");
  const insertExpenseCat = db.prepare('INSERT INTO expense_categories (id, name, iconName) VALUES (?, ?, ?)');
  const initialCategories = [
    { id: `expcat_maintenance_${crypto.randomBytes(3).toString('hex')}`, name: 'Manutenção Frota', iconName: 'Wrench' },
    { id: `expcat_fuel_${crypto.randomBytes(3).toString('hex')}`, name: 'Combustível', iconName: 'Fuel' }, 
    { id: `expcat_operational_${crypto.randomBytes(3).toString('hex')}`, name: 'Despesas Operacionais', iconName: 'Settings' },
    { id: `expcat_marketing_${crypto.randomBytes(3).toString('hex')}`, name: 'Marketing e Publicidade', iconName: 'Megaphone' },
    { id: `expcat_general_${crypto.randomBytes(3).toString('hex')}`, name: 'Despesas Gerais', iconName: 'DollarSign' }, 
    { id: `expcat_other_${crypto.randomBytes(3).toString('hex')}`, name: 'Outro', iconName: 'HelpCircle' },
  ];
  const insertManyCategories = db.transaction((categories) => {
    for (const cat of categories) insertExpenseCat.run(cat.id, cat.name, cat.iconName);
  });
  insertManyCategories(initialCategories);
  console.log("[DB] Default expense categories seeded.");

  // Seed default company settings
  console.log("[DB] Seeding default company settings...");
  const insertSettingStmt = db.prepare('INSERT OR REPLACE INTO company_settings (key, value) VALUES (@key, @value)');
  const insertManySettings = db.transaction((settings) => {
    for (const key in settings) {
      insertSettingStmt.run({ key, value: settings[key as keyof typeof settings] });
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
  insertManySettings(defaultSettings);
  console.log("[DB] Default company settings have been seeded.");

  // Seed default admin user
  console.log("[DB] Seeding default admin user...");
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
