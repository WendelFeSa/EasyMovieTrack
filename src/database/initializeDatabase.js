export async function initializeDatabase(database) {
  try {
    await database.execAsync('PRAGMA foreign_keys = ON;');

    // CRIAR TABELA DE FILMES (Geral)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        overview TEXT,
        poster_path TEXT,
        release_date TEXT
      );
    `);

    // CRIAR TABELA DE USUÁRIOS
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'comum',
        image TEXT,
        avatar_color TEXT DEFAULT '#00E5FF',
        avatar_icon TEXT DEFAULT 'weather-lightning'
      );
    `);

    // CRIAR TABELA DE FILMES ASSISTIDOS
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS user_movies (
        user_id INTEGER NOT NULL,
        movie_id INTEGER NOT NULL,
        watched INTEGER DEFAULT 1, -- 1 para assistido, 0 para não assistido
        rating REAL,                -- Guarda a avaliação por estrelas (ex: 4.5)
        review TEXT,                -- Guarda o comentário/crítica escrito
        watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, movie_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE
      );
    `);

    // CRIAR TABELA DE COMENTÁRIOS E THREADS (Centralizada para o Mural de Discussão)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS movie_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        movie_id INTEGER,
        rating INTEGER,
        review TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE
      );
    `);

    // 2. MIGRATIONS DE SEGURANÇA: Garante as colunas para quem tem o banco antigo
    try {
      await database.execAsync("ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#00E5FF';");
    } catch (e) {}

    try {
      await database.execAsync("ALTER TABLE users ADD COLUMN avatar_icon TEXT DEFAULT 'weather-lightning';");
    } catch (e) {}

    try {
      await database.execAsync("ALTER TABLE users ADD COLUMN image TEXT;");
    } catch (e) {}

    // 3. SEED: Insere o admin se ele não existir no sistema
    await database.execAsync(`
      INSERT OR IGNORE INTO users (name, email, password, role, avatar_color, avatar_icon)
      VALUES ('Comandante', 'admin@adm.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin', '#00E5FF', 'weather-lightning');
    `);

    
    // 4. MIGRATION DE SEGURANÇA: Força o hash da senha do admin se necessário

    const versionResult = await database.getFirstAsync('PRAGMA user_version;');
    const currentVersion = versionResult ? versionResult.user_version : 0;

    if (currentVersion < 1) {
      console.log("Detectado banco antigo ou desatualizado. Forçando hash do Admin...");
      
      await database.execAsync(`
        UPDATE users 
        SET password = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' 
        WHERE email = 'admin@adm.com';
      `);

      await database.execAsync('PRAGMA user_version = 1;');
      console.log("Banco de dados updated com sucesso para a versão 1!");
    }

  } catch (error) {
    console.error("Erro ao inicializar o banco:", error);
  }
}