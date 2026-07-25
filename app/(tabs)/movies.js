import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/theme';
import { getMoviesByAvailability, getMoviesByGenreOnline, getPopularMovies, getTrendingMovies, salvarFilmesNoBanco, searchMoviesLocal, searchMoviesOnline } from '../../src/services/api';
import { AuthSession } from '../../src/services/authSession';
import { getWatchedMovieIds, toggleWatchedMovie } from '../../src/services/movieStorage';
import { globalStyles } from '../../src/styles/globalStyles';

const LISTA_GENEROS = [
  { id: null, name: '🔥 Todos', icon: 'star-four-points' },
  { id: 28, name: 'Ação', icon: 'sword' },
  { id: 35, name: 'Comédia', icon: 'emoticon-lol-outline' },
  { id: 18, name: 'Drama', icon: 'theater' },
  { id: 27, name: 'Terror', icon: 'ghost' },
  { id: 878, name: 'Ficção', icon: 'rocket-launch' },
  { id: 10749, name: 'Romance', icon: 'heart' },
  { id: 16, name: 'Animação', icon: 'animation' }
];

export default function Movies() {
  const db = useSQLiteContext();
  const router = useRouter();
  
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(""); 
  const [selectedGenre, setSelectedGenre] = useState(null);
  
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingTab, setTrendingTab] = useState('day'); 

  const [availMovies, setAvailMovies] = useState([]);
  const [availTab, setAvailTab] = useState('streaming'); 
  
  const [watchedMovieIds, setWatchedMovieIds] = useState([]);

  const scrollViewRef = useRef(null);
  const exibindoHomePrincipal = searchQuery.trim() === "" && selectedGenre === null;

  async function carregarFilmesAssistidos() {
    try {
      const resultado = await getWatchedMovieIds(db, AuthSession.userId);
      setWatchedMovieIds(resultado);
    } catch (error) {
      console.error("Erro ao carregar lista de assistidos do banco:", error);
    }
  }

  async function handleToggleWatched(movie) {
    try {
      const foiAdicionado = await toggleWatchedMovie(db, AuthSession.userId, movie);
      if (foiAdicionado) {
        setWatchedMovieIds(prev => [...prev, movie.id]);
      } else {
        setWatchedMovieIds(prev => prev.filter(id => id !== movie.id));
      }
    } catch (error) {
      console.error("Erro ao alternar status do filme:", error);
    }
  }

  useFocusEffect(
    useCallback(() => {
      carregarFilmesAssistidos();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function sincronizarDadosTMDB() {
        setLoading(true);
        try {
          if (exibindoHomePrincipal) {
            const [dadosTrending, dadosAvail, dadosPopulares] = await Promise.all([
              getTrendingMovies(trendingTab),
              getMoviesByAvailability(availTab),
              getPopularMovies(1)
            ]);

            if (isMounted) {
              setTrendingMovies(dadosTrending);
              setAvailMovies(dadosAvail);
              setMovies(dadosPopulares);
            }

            await salvarFilmesNoBanco(db, [...dadosTrending, ...dadosAvail, ...dadosPopulares]);
          } else {
            let dados = [];
            if (searchQuery.trim() !== "") {
              try {
                dados = await searchMoviesOnline(searchQuery, page);
              } catch (searchError) {
                console.warn('Busca online falhou, usando cache local:', searchError);
                dados = await searchMoviesLocal(db, searchQuery);
              }

              if (dados.length === 0) {
                dados = await searchMoviesLocal(db, searchQuery);
              }
            } else if (selectedGenre !== null) {
              try {
                dados = await getMoviesByGenreOnline(selectedGenre, page);
              } catch (genreError) {
                console.warn('Busca de gênero falhou, retornando lista vazia:', genreError);
                dados = [];
              }
            }
            
            if (isMounted) {
              setMovies(dados);
              if (scrollViewRef.current) {
                scrollViewRef.current.scrollTo({ y: 0, animated: true });
              }
            }
          }
        } catch (e) {
          console.error("Erro ao carregar dados do TMDB:", e);
        } finally {
          if (isMounted) setLoading(false);
        }
      }

      sincronizarDadosTMDB();

      return () => {
        isMounted = false;
      };
    }, [page, searchQuery, selectedGenre, exibindoHomePrincipal, trendingTab, availTab])
  );

  const avancarPagina = () => setPage((prev) => prev + 1);
  const voltarPagina = () => setPage((prev) => (prev > 1 ? prev - 1 : 1));

  const RenderCarrosselHorizontal = ({ data }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={globalStyles.horizontalScroll}>
      {data.map((item) => {
        const jaAssistiu = watchedMovieIds.includes(item.id);
        return (
          <TouchableOpacity 
            key={item.id} 
            style={globalStyles.miniCard}
            onPress={() => router.push(`/movie/${item.id}`)}
            activeOpacity={0.8}
          >
            {item.poster_path ? (
              <Image source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }} style={globalStyles.miniPoster} />
            ) : (
              <View style={[globalStyles.miniPoster, globalStyles.miniPlaceholder]}>
                <MaterialCommunityIcons name="movie-open" size={24} color={Theme.colors.textSecondary} />
              </View>
            )}
            
            <TouchableOpacity 
              style={[globalStyles.floatingMiniCheck, jaAssistiu && { backgroundColor: Theme.colors.primary }]}
              onPress={(e) => {
                e.stopPropagation(); 
                handleToggleWatched(item);
              }}
            >
              <MaterialCommunityIcons 
                name={jaAssistiu ? "eye" : "eye-off-outline"} 
                size={14} 
                color={jaAssistiu ? "#000" : Theme.colors.textSecondary} 
              />
            </TouchableOpacity>

            <Text style={globalStyles.miniTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={globalStyles.miniNote}>⭐ {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <ScrollView ref={scrollViewRef} style={{ backgroundColor: Theme.colors.background }} contentContainerStyle={globalStyles.containerLayout}>
      <View style={globalStyles.headerRow}>
        <MaterialCommunityIcons name="weather-lightning" size={38} color={Theme.colors.primary} style={globalStyles.headerIcon} />
        <Text style={[globalStyles.title, globalStyles.titleOverride]}>FILMES</Text>
      </View>
      <Text style={globalStyles.linkText}>Explore o catálogo completo de filmes.</Text>

      <View style={[globalStyles.input, globalStyles.searchContainer]}>
        <MaterialCommunityIcons name="magnify" size={22} color={Theme.colors.textSecondary} style={globalStyles.searchIcon} />
        <TextInput
          style={globalStyles.searchInput}
          placeholder="Pesquisar filmes online..."
          placeholderTextColor={Theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setSelectedGenre(null);
            setPage(1); 
          }}
        />
      </View>

      <View style={globalStyles.genreWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={globalStyles.genreScroll}>
          {LISTA_GENEROS.map((genre) => {
            const isSelected = selectedGenre === genre.id && searchQuery.trim() === "";
            return (
              <TouchableOpacity
                key={genre.id ?? 'todos'}
                style={[globalStyles.genreChip, isSelected && { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary }]}
                onPress={() => {
                  setSearchQuery("");
                  setSelectedGenre(genre.id);
                  setPage(1);
                }}
              >
                <MaterialCommunityIcons name={genre.icon} size={16} color={isSelected ? '#000' : Theme.colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={[globalStyles.genreText, isSelected && { color: '#000', fontWeight: 'bold' }]}>{genre.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {exibindoHomePrincipal && !loading && (
        <View style={{ width: '100%' }}>
          <View style={globalStyles.sectionHeaderContainer}>
            <Text style={globalStyles.sectionTitle}>Tendências</Text>
            <View style={globalStyles.toggleContainer}>
              <TouchableOpacity style={[globalStyles.toggleBtn, trendingTab === 'day' && globalStyles.toggleBtnActive]} onPress={() => setTrendingTab('day')}>
                <Text style={[globalStyles.toggleText, trendingTab === 'day' && globalStyles.toggleTextActive]}>Hoje</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[globalStyles.toggleBtn, trendingTab === 'week' && globalStyles.toggleBtnActive]} onPress={() => setTrendingTab('week')}>
                <Text style={[globalStyles.toggleText, trendingTab === 'week' && globalStyles.toggleTextActive]}>Na semana</Text>
              </TouchableOpacity>
            </View>
          </View>
          <RenderCarrosselHorizontal data={trendingMovies} />

          <View style={[globalStyles.sectionHeaderContainer, { marginTop: 25 }]}>
            <Text style={globalStyles.sectionTitle}>Populares por categoria</Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={globalStyles.subTabsContainer}>
            <TouchableOpacity style={[globalStyles.subTabItem, availTab === 'streaming' && globalStyles.subTabItemActive]} onPress={() => setAvailTab('streaming')}><Text style={[globalStyles.subTabText, availTab === 'streaming' && globalStyles.subTabTextActive]}>Streaming</Text></TouchableOpacity>
            <TouchableOpacity style={[globalStyles.subTabItem, availTab === 'tv' && globalStyles.subTabItemActive]} onPress={() => setAvailTab('tv')}><Text style={[globalStyles.subTabText, availTab === 'tv' && globalStyles.subTabTextActive]}>Na TV</Text></TouchableOpacity>
            <TouchableOpacity style={[globalStyles.subTabItem, availTab === 'alugar' && globalStyles.subTabItemActive]} onPress={() => setAvailTab('alugar')}><Text style={[globalStyles.subTabText, availTab === 'alugar' && globalStyles.subTabTextActive]}>Para Alugar</Text></TouchableOpacity>
            <TouchableOpacity style={[globalStyles.subTabItem, availTab === 'cinema' && globalStyles.subTabItemActive]} onPress={() => setAvailTab('cinema')}><Text style={[globalStyles.subTabText, availTab === 'cinema' && globalStyles.subTabTextActive]}>Nos Cinemas</Text></TouchableOpacity>
          </ScrollView>
          <RenderCarrosselHorizontal data={availMovies} />

          <Text style={[globalStyles.sectionTitle, { marginTop: 30, marginBottom: 15 }]}>Mais Procurados do Catálogo</Text>
        </View>
      )}

      {loading ? (
        <View style={globalStyles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={globalStyles.loadingText}>Sincronizando com o TMDB...</Text>
        </View>
      ) : movies.length === 0 ? (
        <View style={globalStyles.loadingContainer}>
          <MaterialCommunityIcons name="movie-roll" size={50} color={Theme.colors.textSecondary} />
          <Text style={[globalStyles.loadingText, { marginTop: 10 }]}>Nenhum filme encontrado.</Text>
        </View>
      ) : (
        <View style={{ width: '100%' }}>
          {movies.map((movie) => {
            const jaAssistiu = watchedMovieIds.includes(movie.id);

            return (
              <TouchableOpacity 
                key={movie.id} 
                style={globalStyles.movieCard}
                onPress={() => router.push(`/movie/${movie.id}`)}
                activeOpacity={0.7}
              >
                {movie.poster_path ? (
                  <Image source={{ uri: `https://image.tmdb.org/t/p/w200${movie.poster_path}` }} style={globalStyles.posterImage} />
                ) : (
                  <View style={globalStyles.posterPlaceholder}>
                    <MaterialCommunityIcons name="movie-open-play" size={40} color={Theme.colors.textSecondary} />
                  </View>
                )}
                <View style={globalStyles.movieInfo}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <Text style={[globalStyles.movieTitle, { flex: 1, paddingRight: 8 }]} numberOfLines={2}>{movie.title}</Text>
                    
                    <TouchableOpacity 
                      style={[globalStyles.actionButton, jaAssistiu && globalStyles.actionButtonActive]} 
                      onPress={(e) => {
                        e.stopPropagation(); 
                        handleToggleWatched(movie);
                      }}
                    >
                      <MaterialCommunityIcons 
                        name={jaAssistiu ? "eye" : "eye-outline"} 
                        size={22} 
                        color={jaAssistiu ? Theme.colors.primary : Theme.colors.textSecondary} 
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={globalStyles.movieYear}>Lançamento: {movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</Text>
                  <Text style={globalStyles.movieOverview} numberOfLines={3}>{movie.overview || "Sinopse não disponível."}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {!exibindoHomePrincipal && (
            <View style={globalStyles.paginationContainer}>
              <TouchableOpacity style={[globalStyles.pageButton, { backgroundColor: page === 1 ? '#161B22' : Theme.colors.surface, borderWidth: 1, borderColor: '#2D333B' }]} onPress={voltarPagina} disabled={page === 1}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={page === 1 ? '#484F58' : Theme.colors.text} />
                <Text style={[globalStyles.pageButtonText, { color: page === 1 ? '#484F58' : Theme.colors.text }]}>Anterior</Text>
              </TouchableOpacity>
              <View style={[globalStyles.pageIndicator, { backgroundColor: Theme.colors.primary }]}><Text style={[globalStyles.pageIndicatorText, { color: '#000' }]}>{page}</Text></View>
              <TouchableOpacity style={[globalStyles.pageButton, { backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: '#2D333B' }]} onPress={avancarPagina}>
                <Text style={[globalStyles.pageButtonText, { color: Theme.colors.text }]}>Próximo</Text>
                <MaterialCommunityIcons name="chevron-right" size={24} color={Theme.colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}