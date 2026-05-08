
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DB_FILE_NAME = 'dhalugueis_v2.db';
const dataDirectory = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDirectory, DB_FILE_NAME);

const symbolForDb = Symbol.for('dhalugueis_v2.db.instance');

interface GlobalWithDb {
  [symbolForDb]?: Database.Database;
}

const globalWithDb = global as GlobalWithDb;

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function runMigrations(db: Database.Database) {
    console.log("[DB Migration] Checking for necessary schema migrations...");

    // Migration for unitAcquisitionPrice and forRental in inventory table
    try {
        const columns = db.pragma('table_info(inventory)') as { name: string }[];
        
        if (!columns.some(col => col.name === 'unitAcquisitionPrice')) {
            console.log("[DB Migration] Adding 'unitAcquisitionPrice' to inventory table.");
            db.exec('ALTER TABLE inventory ADD COLUMN unitAcquisitionPrice REAL DEFAULT 0');
        }
        
        if (!columns.some(col => col.name === 'forRental')) {
            console.log("[DB Migration] Adding 'forRental' to inventory table.");
            db.exec('ALTER TABLE inventory ADD COLUMN forRental INTEGER DEFAULT 1');
            db.exec('UPDATE inventory SET forRental = 1 WHERE forRental IS NULL');
        }
    } catch (error) {
        console.error("[DB Migration] Error during inventory columns migration:", error);
    }

    // Migration for purchases table
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS purchases (
                id TEXT PRIMARY KEY,
                inventoryId TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                unitPrice REAL NOT NULL,
                freightValue REAL DEFAULT 0,
                totalAmount REAL NOT NULL,
                purchaseDate TEXT NOT NULL,
                notes TEXT,
                affectsStock INTEGER DEFAULT 1,
                batchId TEXT,
                FOREIGN KEY (inventoryId) REFERENCES inventory(id) ON DELETE RESTRICT
            );
        `);
        
        const columns = db.pragma('table_info(purchases)') as { name: string }[];
        if (!columns.some(col => col.name === 'affectsStock')) {
            db.exec('ALTER TABLE purchases ADD COLUMN affectsStock INTEGER DEFAULT 1');
        }
        if (!columns.some(col => col.name === 'batchId')) {
            db.exec('ALTER TABLE purchases ADD COLUMN batchId TEXT');
        }
    } catch (error) {
        console.error("[DB Migration] Error ensuring 'purchases' table exists:", error);
    }

    // Migration for fuelValue in rentals table
    try {
        const columns = db.pragma('table_info(rentals)') as { name: string }[];
        const hasFuelValue = columns.some(col => col.name === 'fuelValue');
        const hasFullTank = columns.some(col => col.name === 'deliveredWithFullTank');
        
        if (!hasFuelValue) {
            db.exec('ALTER TABLE rentals ADD COLUMN fuelValue REAL DEFAULT 0');
        }
        if (!hasFullTank) {
            db.exec('ALTER TABLE rentals ADD COLUMN deliveredWithFullTank INTEGER DEFAULT 0');
        }
    } catch (error) {
        console.error("[DB Migration] Error during fuel columns migration:", error);
    }

    // Migration for returnNotificationSent in rentals table
    try {
        const columns = db.pragma('table_info(rentals)') as { name: string }[];
        if (!columns.some(col => col.name === 'returnNotificationSent')) {
            db.exec('ALTER TABLE rentals ADD COLUMN returnNotificationSent TEXT');
        }
    } catch (error) {
        console.error("[DB Migration] Error during notification column migration:", error);
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
    } catch (error) {
        console.error("[DB Migration] Error ensuring 'notification_logs' table exists:", error);
    }

    // Migration for customer document columns
    try {
        const columns = db.pragma('table_info(customers)') as { name: string }[];
        if (!columns.some(col => col.name === 'documentType')) {
            db.exec(`ALTER TABLE customers ADD COLUMN documentType TEXT CHECK(documentType IN ('cpf', 'cnpj')) DEFAULT 'cpf';`);
            db.exec(`ALTER TABLE customers ADD COLUMN documentNumber TEXT;`);
        }
    } catch (error) {
        console.error("[DB Migration] Error during document columns migration:", error);
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
    } catch (error) {
        console.error("[DB Migration] Error ensuring 'payments' table exists:", error);
    }

    // Migration for quotes and quote_equipment tables
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
    } catch(error) {
        console.error("[DB Migration] Error ensuring 'quotes' or 'quote_equipment' tables exist:", error);
    }
    
    console.log("[DB Migration] Schema check complete.");
}

function initializeDb() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }
  
  const dbExists = fs.existsSync(dbPath);
  
  try {
    const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined }); 
    
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    if (!dbExists) {
      initializeSchemaAndSeed(db);
    } else {
      runMigrations(db);
    }
    
    if (process.env.NODE_ENV !== 'production' || !globalWithDb[symbolForDb]) {
        process.on('exit', () => {
            if(db && db.open) {
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
    if (!globalWithDb[symbolForDb]) {
        globalWithDb[symbolForDb] = initializeDb();
    }
    return globalWithDb[symbolForDb]!;
}

export function closeDb() {
  if (globalWithDb[symbolForDb] && globalWithDb[symbolForDb]!.open) {
    globalWithDb[symbolForDb]!.close();
    globalWithDb[symbolForDb] = undefined;
  }
}

function initializeSchemaAndSeed(db: Database.Database) {
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
        unitAcquisitionPrice REAL DEFAULT 0,
        forRental INTEGER DEFAULT 1,
        FOREIGN KEY (typeId) REFERENCES equipment_types(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        inventoryId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unitPrice REAL NOT NULL,
        freightValue REAL DEFAULT 0,
        totalAmount REAL NOT NULL,
        purchaseDate TEXT NOT NULL,
        notes TEXT,
        affectsStock INTEGER DEFAULT 1,
        batchId TEXT,
        FOREIGN KEY (inventoryId) REFERENCES inventory(id) ON DELETE RESTRICT
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

  const insertSettingStmt = db.prepare('INSERT OR REPLACE INTO company_settings (key, value) VALUES (@key, @value)');
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
  const insertManySettings = db.transaction((settings) => {
    for (const key in settings) {
      insertSettingStmt.run({ key, value: settings[key as keyof typeof settings] });
    }
  });
  insertManySettings(defaultSettings);

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
}
