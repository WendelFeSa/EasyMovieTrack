import axios from 'axios';

//Variável de ambiente nativa para segurança do Token TMDB
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
  if (!texto) return "Pipoca pronta, mas a sinopse deste filme ainda está sendo preparada pela nossa equipe! 🍿✨";
  
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
        sort_by: 'popularity.desc', // Traz os mais populares daquele gênero primeiro
        include_adult: false
      }
    });

    if (!response.data || !response.data.results) {
      return [];
    }

    // Reaproveita o tratamento de sinopses e traduções para garantir qualidade mesmo em buscas por gênero
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

    // Se o servidor não devolver resultados válidos, retorna um array vazio com segurança
    if (!response.data || !response.data.results) {
      return [];
    }

    const filmesModificados = await ajustarDadosFilmes(response.data.results);

    // Implementação de ordenação inteligente: Filmes que começam com o termo de busca aparecem primeiro, seguidos por ordem alfabética
    const queryLimpa = termoBusca.toLowerCase();
    
    // Filtro para garantir que operamos apenas em dados válidos
    const filmesValidos = filmesModificados.filter(m => m && m.title);

    filmesValidos.sort((a, b) => {
      const aComeca = a.title.toLowerCase().startsWith(queryLimpa);
      const bComeca = b.title.toLowerCase().startsWith(queryLimpa);
      
      if (aComeca && !bComeca) return -1; // 'a' vai para o topo
      if (!aComeca && bComeca) return 1;  // 'b' vai para o topo
      return a.title.localeCompare(b.title); // Ordem alfabética em caso de empate
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
    return await ajustarDadosFilmes(response.data.results.slice(0, 10)); // Pega os 10 primeiros
  } catch (error) {
    console.error(`Erro ao buscar tendências (${timeWindow}):`, error.message);
    return [];
  }
};

// FUNÇÃO: Busca filmes por distribuição (Nos Cinemas ou plataformas)
// OBS: A API do TMDB tem limitações para disponibilidades específicas, então usei os filtros mais próximos para cada categoria
export const getMoviesByAvailability = async (type = 'cinema') => {
  try {
    let endpoint = '/movie/now_playing'; // Padrão: Nos Cinemas
    let extraParams = {};

    if (type === 'streaming') {
      endpoint = '/discover/movie';
      extraParams = { with_watch_providers: '8|119|337', watch_region: 'BR' }; // Netflix, Prime, Disney+
    } else if (type === 'tv') {
      endpoint = '/movie/upcoming'; // Próximos lançamentos / Grade de TV
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

// FUNÇÃO AUXILIAR DA API: Varre a lista aplicando traduções e tratamentos de erros nas sinopses
const ajustarDadosFilmes = async (movies) => {
  const promessasDeAjuste = movies.map(async (movie) => {
    let tituloFinal = movie.title;
    let sinopseFinal = movie.overview;

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

// Função: Busca os detalhes de um único filme pelo ID usando as regras de tradução existentes
export const getMovieDetailsOnline = async (movieId) => {
  try {
    const response = await api.get(`/movie/${movieId}`, {
      params: { language: 'pt-BR' }
    });
    
    // Passei em formato de array para reaproveitar a função 'ajustarDadosFilmes' sem duplicar lógica
    const [filmeAjustado] = await ajustarDadosFilmes([response.data]);
    return filmeAjustado;
  } catch (error) {
    console.error(`Erro ao buscar detalhes do filme ${movieId}:`, error.message);
    return null;
  }
};

export default api;