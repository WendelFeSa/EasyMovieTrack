import axios from 'axios';

// Variável de ambiente nativa para segurança do Token TMDB
const tokenTMDB = process.env.EXPO_PUBLIC_TMDB_TOKEN;

const api = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${tokenTMDB}`
  },
  params: {
    region: 'BR'
  }
});

// FUNÇÃO AUXILIAR: Traduz o texto usando a API livre do Google Tradutor
const traduzirParaPortugues = async (texto) => {
  if (!texto) return "Pipoca pronta, mas esta informação ainda está sendo preparada pela nossa equipe! 🍿✨";
  
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(texto)}`;
    const response = await axios.get(url);
    const textoTraduzido = response.data[0].map(item => item[0]).join('');
    return textoTraduzido || texto;
  } catch (error) {
    console.log("Aviso: Limite de tradução atingido ou erro no Google, usando texto original.");
    return texto;
  }
};

// FUNÇÃO AUXILIAR DA API: Varre a lista aplicando traduções e tratamentos de erros nas sinopses e títulos
const ajustarDadosFilmes = async (movies) => {
  if (!Array.isArray(movies)) return [];

  const promessasDeAjuste = movies.map(async (movie) => {
    let tituloFinal = movie.title;
    let sinopseFinal = movie.overview;

    // Caso a sinopse em PT-BR venha vazia ou muito curta, faz fallback para EN-US e traduz
    if (!sinopseFinal || sinopseFinal.trim().length < 5) {
      try {
        const fallbackResponse = await api.get(`/movie/${movie.id}`, { params: { language: 'en-US' } });
        const dadosEmIngles = fallbackResponse.data;

        if (dadosEmIngles.overview && dadosEmIngles.overview.trim().length > 5) {
          sinopseFinal = await traduzirParaPortugues(dadosEmIngles.overview);
        } else {
          sinopseFinal = "Pipoca pronta, mas a sinopse deste filme ainda está sendo preparada pela nossa equipe! 🍿✨";
        }

        if (dadosEmIngles.title && dadosEmIngles.title !== movie.title) {
          tituloFinal = await traduzirParaPortugues(dadosEmIngles.title);
        }
      } catch (e) {
        sinopseFinal = "Sinopse indisponível no momento. Que tal dar o play e descobrir a história? 🎬";
      }
    }

    // Tratamento para títulos que contêm apenas ideogramas ou caracteres especiais sem tradução
    const contemLetrasNormais = /[a-zA-Z0-9]/.test(tituloFinal);
    if (!contemLetrasNormais) {
      try {
        const fallbackResponse = await api.get(`/movie/${movie.id}`, { params: { language: 'en-US' } });
        tituloFinal = await traduzirParaPortugues(fallbackResponse.data.title);
      } catch (e) {
        tituloFinal = "Filme Internacional";
      }
    }

    return {
      ...movie,
      title: tituloFinal,
      overview: sinopseFinal
    };
  });

  return await Promise.all(promessasDeAjuste);
};

// FUNÇÃO PADRÃO: Busca filmes populares da página inicial
export const getPopularMovies = async (page = 1) => {
  try {
    const response = await api.get('/movie/popular', { 
      params: { 
        language: 'pt-BR',
        page: page 
      } 
    });
    
    return await ajustarDadosFilmes(response.data.results);
  } catch (error) {
    console.error("Erro ao buscar filmes populares no TMDB:", error.response?.data || error.message);
    throw error;
  }
};

// FUNÇÃO: Busca filmes online filtrados por Gênero
export const getMoviesByGenreOnline = async (genreId, page = 1) => {
  if (!genreId) return [];

  try {
    const response = await api.get('/discover/movie', {
      params: {
        with_genres: genreId,
        language: 'pt-BR',
        page: page,
        sort_by: 'popularity.desc',
        include_adult: false
      }
    });

    if (!response.data || !response.data.results) {
      return [];
    }

    return await ajustarDadosFilmes(response.data.results);
  } catch (error) {
    console.error("Erro ao buscar filmes por gênero no TMDB:", error.response?.data || error.message);
    return [];
  }
};

// FUNÇÃO DE BUSCA PROTEGIDA CONTRA ERROS DE CONEXÃO
export const searchMoviesOnline = async (queryText = "", page = 1) => {
  const termoBusca = queryText ? queryText.trim() : "";
  if (!termoBusca) return [];

  try {
    const response = await api.get('/search/movie', {
      params: {
        query: termoBusca,
        language: 'pt-BR',
        page: page,
        include_adult: false
      }
    });

    if (!response.data || !response.data.results) {
      return [];
    }

    const filmesModificados = await ajustarDadosFilmes(response.data.results);

    const queryLimpa = termoBusca.toLowerCase();
    const filmesValidos = filmesModificados.filter(m => m && m.title);

    filmesValidos.sort((a, b) => {
      const aComeca = a.title.toLowerCase().startsWith(queryLimpa);
      const bComeca = b.title.toLowerCase().startsWith(queryLimpa);
      
      if (aComeca && !bComeca) return -1;
      if (!aComeca && bComeca) return 1;
      return a.title.localeCompare(b.title);
    });

    return filmesValidos;
  } catch (error) {
    console.error("Erro ao buscar filmes online no TMDB:", error.response?.data || error.message);
    return [];
  }
};

// FUNÇÃO: Busca filmes em tendência (Hoje ou Semana)
export const getTrendingMovies = async (timeWindow = 'day') => {
  try {
    const response = await api.get(`/trending/movie/${timeWindow}`, {
      params: { language: 'pt-BR' }
    });
    return await ajustarDadosFilmes(response.data.results.slice(0, 10));
  } catch (error) {
    console.error(`Erro ao buscar tendências (${timeWindow}):`, error.message);
    return [];
  }
};

// FUNÇÃO: Busca filmes por distribuição (Nos Cinemas ou plataformas)
export const getMoviesByAvailability = async (type = 'cinema') => {
  try {
    let endpoint = '/movie/now_playing';
    let extraParams = {};

    if (type === 'streaming') {
      endpoint = '/discover/movie';
      extraParams = { with_watch_providers: '8|119|337', watch_region: 'BR' };
    } else if (type === 'tv') {
      endpoint = '/movie/upcoming';
    } else if (type === 'alugar') {
      endpoint = '/discover/movie';
      extraParams = { with_watch_monetization_types: 'rent', watch_region: 'BR' };
    }

    const response = await api.get(endpoint, {
      params: {
        language: 'pt-BR',
        page: 1,
        ...extraParams
      }
    });

    return await ajustarDadosFilmes(response.data.results.slice(0, 10));
  } catch (error) {
    console.error(`Erro ao buscar filmes por disponibilidade (${type}):`, error.message);
    return [];
  }
};

// Função: Busca os detalhes de um único filme pelo ID usando as regras de tradução existentes
export const getMovieDetailsOnline = async (movieId) => {
  try {
    const response = await api.get(`/movie/${movieId}`, {
      params: { language: 'pt-BR' }
    });
    
    const [filmeAjustado] = await ajustarDadosFilmes([response.data]);
    return filmeAjustado;
  } catch (error) {
    console.error(`Erro ao buscar detalhes do filme ${movieId}:`, error.message);
    return null;
  }
};

// ✨ ATUALIZADO: Buscar detalhes do ator (com tradução automática de biografia caso não exista em PT-BR)
export const getActorDetails = async (personId) => {
  try {
    const response = await api.get(`/person/${personId}`, {
      params: { language: 'pt-BR' }
    });
    
    let atorData = response.data;

    // Se a biografia veio vazia em português, busca em inglês e traduz via Google Translate
    if (!atorData.biography || atorData.biography.trim().length < 5) {
      try {
        const fallbackResponse = await api.get(`/person/${personId}`, {
          params: { language: 'en-US' }
        });
        
        if (fallbackResponse.data.biography && fallbackResponse.data.biography.trim().length > 5) {
          atorData.biography = await traduzirParaPortugues(fallbackResponse.data.biography);
        } else {
          atorData.biography = "Biografia indisponível no momento para este artista.";
        }
      } catch (e) {
        atorData.biography = "Biografia não informada.";
      }
    }

    return atorData;
  } catch (error) {
    console.error(`Erro ao buscar detalhes do ator ${personId}:`, error.message);
    return null;
  }
};

// ✨ ATUALIZADO: Buscar a lista de filmes em que o ator atuou (com títulos traduzidos e ordenação)
export const getActorMovieCredits = async (personId) => {
  try {
    const response = await api.get(`/person/${personId}/movie_credits`, {
      params: { language: 'pt-BR' }
    });
    
    const cast = response.data.cast || [];
    
    // Ordena do mais popular para o menos popular
    const castOrdenado = cast.sort((a, b) => b.popularity - a.popularity);

    // Aplica o tratamento de títulos e sinopses traduzidas na lista do ator
    return await ajustarDadosFilmes(castOrdenado);
  } catch (error) {
    console.error(`Erro ao buscar créditos do ator ${personId}:`, error.message);
    return [];
  }
};

// FUNÇÕES DE BANCO DE DADOS: Salva cache e faz busca local na tabela de filmes
export const salvarFilmesNoBanco = async (db, movies) => {
  if (!db || !Array.isArray(movies) || movies.length === 0) return 0;

  const statement = `INSERT OR IGNORE INTO movies (id, title, overview, poster_path, release_date) VALUES (?, ?, ?, ?, ?);`;
  let savedCount = 0;

  for (const movie of movies) {
    if (!movie?.id) continue;

    const id = Number(movie.id);
    if (!Number.isFinite(id)) {
      console.warn('salvarFilmesNoBanco ignorou filme com id inválido:', movie?.id);
      continue;
    }

    const title = movie.title != null ? String(movie.title) : null;
    const overview = movie.overview != null ? String(movie.overview) : null;
    const poster_path = movie.poster_path != null ? String(movie.poster_path) : null;
    const release_date = movie.release_date != null ? String(movie.release_date) : null;

    try {
      await db.runAsync(statement, [id, title, overview, poster_path, release_date]);
      savedCount += 1;
    } catch (error) {
      console.warn(`Erro ao salvar filme ${id} no banco local:`, error);
    }
  }

  return savedCount;
};

export const searchMoviesLocal = async (db, queryText = '') => {
  if (!db || !queryText.trim()) return [];

  const termoBusca = `%${queryText.trim()}%`;
  try {
    const results = await db.getAllAsync(
      `SELECT * FROM movies
       WHERE title LIKE ? OR overview LIKE ?
       ORDER BY release_date DESC
       LIMIT 50;`,
      [termoBusca, termoBusca]
    );

    return results || [];
  } catch (error) {
    console.error('Erro ao buscar filmes localmente:', error);
    return [];
  }
};

export default api;