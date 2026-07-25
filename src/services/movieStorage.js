/**
 * Salva as informações gerais do filme na tabela 'movies' para servir de cache local
 */
async function saveMovieCache(database, movie) {
  if (!database || !movie || !movie.id) return;

  try {
    await database.runAsync(
      `INSERT OR IGNORE INTO movies (id, title, overview, poster_path, release_date) 
       VALUES (?, ?, ?, ?, ?);`,
      [movie.id, movie.title, movie.overview, movie.poster_path, movie.release_date]
    );
  } catch (error) {
    console.error("Erro ao salvar cache do filme:", error);
  }
}

/**
 * Atualiza ou insere o registro de filme assistido para o usuário.
 */
export async function setMovieWatched(database, userId, movie, watched = true) {
  if (!database || !userId || !movie || !movie.id) return false;

  try {
    await saveMovieCache(database, movie);

    const row = await database.getFirstAsync(
      "SELECT watched FROM user_movies WHERE user_id = ? AND movie_id = ?;",
      [userId, movie.id]
    );

    if (row) {
      await database.runAsync(
        "UPDATE user_movies SET watched = ? WHERE user_id = ? AND movie_id = ?;",
        [watched ? 1 : 0, userId, movie.id]
      );
    } else {
      await database.runAsync(
        "INSERT INTO user_movies (user_id, movie_id, watched) VALUES (?, ?, ?);",
        [userId, movie.id, watched ? 1 : 0]
      );
    }

    return watched;
  } catch (error) {
    console.error("Erro ao atualizar status de assistido:", error);
    throw error;
  }
}

/**
 * Adiciona ou alterna o status de um filme na lista de assistidos do usuário (Toggle seguro)
 * Retorna true se o filme passou a ser assistido, ou false se foi desmarcado.
 */
export async function toggleWatchedMovie(database, userId, movie) {
  if (!database || !userId || !movie || !movie.id) return false;

  try {
    const row = await database.getFirstAsync(
      "SELECT watched FROM user_movies WHERE user_id = ? AND movie_id = ?;",
      [userId, movie.id]
    );

    const novoStatus = row ? (row.watched === 1 ? 0 : 1) : 1;
    return await setMovieWatched(database, userId, movie, novoStatus === 1);
  } catch (error) {
    console.error("Erro ao alternar status de assistido:", error);
    throw error;
  }
}

/**
 * Verifica se um filme específico já foi marcado como assistido por aquele usuário
 */
export async function isMovieWatched(database, userId, movieId) {
  if (!database || !userId || !movieId) return false;

  try {
    const row = await database.getFirstAsync(
      "SELECT watched FROM user_movies WHERE user_id = ? AND movie_id = ?;",
      [userId, movieId]
    );
    return row?.watched === 1;
  } catch (error) {
    console.error("Erro ao verificar se filme foi assistido:", error);
    return false;
  }
}

/**
 * Retorna todos os IDs de filmes marcados como assistidos pelo usuário.
 */
export async function getWatchedMovieIds(database, userId) {
  if (!database || !userId) return [];

  try {
    const resultado = await database.getAllAsync(
      "SELECT movie_id FROM user_movies WHERE user_id = ? AND watched = 1;",
      [userId]
    );
    return resultado.map((item) => item.movie_id);
  } catch (error) {
    console.error("Erro ao buscar IDs de filmes assistidos:", error);
    return [];
  }
}

/**
 * Retorna a lista completa de filmes assistidos e seus dados em cache local.
 */
export async function getUserWatchedMovies(database, userId) {
  if (!database || !userId) return [];

  try {
    return await database.getAllAsync(
      `SELECT 
         um.movie_id, 
         m.title,
         m.overview,
         m.poster_path,
         m.release_date,
         um.watched_at
       FROM user_movies um
       LEFT JOIN movies m ON um.movie_id = m.id
       WHERE um.user_id = ? AND um.watched = 1
       ORDER BY um.watched_at DESC;`,
      [userId]
    );
  } catch (error) {
    console.error("Erro ao buscar filmes assistidos do usuário:", error);
    return [];
  }
}
