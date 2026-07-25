import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/theme';
import api, { getMovieDetailsOnline } from '../../src/services/api';
import { AuthSession } from '../../src/services/authSession';
import { isMovieWatched, toggleWatchedMovie } from '../../src/services/movieStorage';
import { globalStyles } from '../../src/styles/globalStyles';

export default function MovieDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const db = useSQLiteContext();

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null); // ✨ Estado para gerenciar os dados do usuário atual em tempo real
  
  const [movieDetails, setMovieDetails] = useState({
    runtime: null, genres: [], cast: [], director: '', writer: '', originalLanguage: '', budget: 0, revenue: 0, status: ''
  });

  const [rating, setRating] = useState(0); 
  const [review, setReview] = useState(""); 
  const [watched, setWatched] = useState(false);  

  const [editingReviewId, setEditingReviewId] = useState(null); 
  const [replyTarget, setReplyTarget] = useState(null); 
  const [editingReplyIndex, setEditingReplyIndex] = useState(null); 

  const [allReviews, setAllReviews] = useState([]);

  const isAdmin = 
    AuthSession.userEmail?.toLowerCase().includes('admin') || 
    AuthSession.role === 'admin';

  const formatarMoeda = (valor) => {
    if (!valor || valor === 0) return 'Não informado';
    return '$' + valor.toFixed(0).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
  };

  const traduzirStatus = (status) => {
    const opcoes = {
      'Released': 'Lançado', 'In Production': 'Em Produção', 'Post Production': 'Pós-Produção',
      'Planned': 'Planejado', 'Canceled': 'Cancelado', 'Rumored': 'Rumores'
    };
    return opcoes[status] || status || 'Não informado';
  };

  const obterTamanhoFonteTitulo = (titulo) => {
    if (!titulo) return 22;
    if (titulo.length > 25) return 18;
    if (titulo.length > 15) return 20;
    return 22;
  };

  const renderAvatar = (image, avatarColor, avatarIcon, estiloImagem, estiloPlaceholder, tamanhoIcone) => {
    if (image && image !== "NULO" && image !== "undefined" && (image.startsWith('http') || image.startsWith('file') || image.startsWith('content'))) {
      return <Image source={{ uri: image }} style={estiloImagem} />;
    }

    if (avatarColor || avatarIcon) {
      const corFundo = avatarColor || Theme.colors.primary;
      const nomeIcone = avatarIcon || 'weather-lightning';
      return (
        <View style={[estiloPlaceholder, { backgroundColor: corFundo, justifyContent: 'center', alignItems: 'center' }]}>
          <MaterialCommunityIcons 
            name={nomeIcone} 
            size={tamanhoIcone} 
            color={corFundo === '#FFFFFF' ? '#000000' : '#FFFFFF'} 
          />
        </View>
      );
    }

    return (
      <View style={estiloPlaceholder}>
        <MaterialCommunityIcons name="account" size={tamanhoIcone} color={Theme.colors.textSecondary} />
      </View>
    );
  };

  async function buscarDetalhesAPI(movieId) {
    try {
      const filmeOnline = await getMovieDetailsOnline(movieId);
      if (!filmeOnline) return null;

      setMovie(filmeOnline);

      try {
        await db.runAsync(
          "UPDATE movies SET title = ?, overview = ? WHERE id = ?;",
          [filmeOnline.title, filmeOnline.overview, movieId]
        );
      } catch (dbErr) {
        console.log("Aviso ao atualizar cache local do filme:", dbErr.message);
      }

      const creditsResponse = await api.get(`/movie/${movieId}/credits`, {
        params: { language: 'pt-BR' }
      });
      const creditsData = creditsResponse.data;

      const detailsResponse = await api.get(`/movie/${movieId}`, {
        params: { language: 'pt-BR' }
      });
      const detailsData = detailsResponse.data;

      const directorObj = creditsData.crew?.find(person => person.job === "Director");
      const writerObj = creditsData.crew?.find(person => person.job === "Writer" || person.job === "Screenplay");

      const topCast = creditsData.cast?.slice(0, 10).map(actor => ({
        name: actor.name,
        profile_path: actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null
      })) || [];

      setMovieDetails({
        runtime: detailsData.runtime ? `${detailsData.runtime} min` : 'N/A',
        genres: detailsData.genres?.map(g => g.name) || [],
        cast: topCast,
        director: directorObj ? directorObj.name : 'Não informado',
        writer: writerObj ? writerObj.name : 'Não informado',
        originalLanguage: detailsData.original_language ? detailsData.original_language.toUpperCase() : 'N/A',
        budget: detailsData.budget || 0,
        revenue: detailsData.revenue || 0,
        status: traduzirStatus(detailsData.status)
      });

      return filmeOnline;
    } catch (error) {
      console.error("Erro ao carregar dados complementares pela API:", error);
      return null;
    }
  }

  async function carregarDadosCompletos() {
    try {
      // ✨ LIMPADO: O "CREATE TABLE IF NOT EXISTS movie_reviews" foi removido daqui!

      // ✨ BUSCA DINÂMICA: Carrega os dados atualizados do seu perfil localmente
      const usuarioAtual = await db.getFirstAsync(
        "SELECT name, image, avatar_color, avatar_icon FROM users WHERE id = ?;", 
        [AuthSession.userId]
      );
      if (usuarioAtual) {
        setUser(usuarioAtual);
      }

      let filmeValido = null;

      try {
        filmeValido = await buscarDetalhesAPI(id);
      } catch (apiError) {
        console.log("Falha ao buscar dados online, tentando buscar no banco local...", apiError);
      }

      if (!filmeValido) {
        const localMovie = await db.getFirstAsync("SELECT * FROM movies WHERE id = ?;", [id]);
        if (localMovie) {
          setMovie(localMovie);
        }
      }

      const watchedStatus = await isMovieWatched(db, AuthSession.userId, id);
      setWatched(watchedStatus);

      const reviewsPublicos = await db.getAllAsync(
        `SELECT mr.id, mr.user_id, mr.movie_id, mr.rating, mr.review, 
                u.name AS autor_nome, u.image AS autor_foto, 
                u.avatar_color AS autor_cor, u.avatar_icon AS autor_icone
         FROM movie_reviews mr
         INNER JOIN users u ON mr.user_id = u.id
         WHERE mr.movie_id = ? AND (mr.review IS NOT NULL AND mr.review != '')
         ORDER BY mr.id DESC;`,
         [id]
      );
      setAllReviews(reviewsPublicos);

    } catch (error) {
      console.error("Erro geral no carregamento de detalhes:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarDadosCompletos();
  }, [id, editingReviewId, replyTarget]);

  async function toggleAssistido() {
    try {
      const currentMovie = {
        id: Number(id),
        title: movie?.title || '',
        overview: movie?.overview || '',
        poster_path: movie?.poster_path || null,
        release_date: movie?.release_date || null
      };

      const novoStatus = await toggleWatchedMovie(db, AuthSession.userId, currentMovie);
      setWatched(novoStatus);
      Alert.alert("Sucesso", novoStatus ? "Marcado como Assistido! 👁️" : "Removido de Assistidos.");
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSalvarAvaliacao() {
    if (!review || review.trim() === "") {
      Alert.alert("Campo Obrigatório", "Por favor, digite uma mensagem antes de publicar.");
      return;
    }

    if (!replyTarget && editingReplyIndex === null && editingReviewId === null && (rating < 1 || rating > 5)) {
      Alert.alert("Ops!", "Por favor, atribua uma nota de 1 a 5 estrelas antes de salvar.");
      return;
    }

    try {
      const minhaConta = await db.getFirstAsync("SELECT name, image, avatar_color, avatar_icon FROM users WHERE id = ?;", [AuthSession.userId]);
      const nomeDoAutorLogado = minhaConta?.name || "Usuário";
      const fotoDoAutorLogado = minhaConta?.image || "NULO";
      const corDoAutorLogado = minhaConta?.avatar_color || "NULO";
      const iconeDoAutorLogado = minhaConta?.avatar_icon || "NULO";

      if (editingReplyIndex !== null && editingReviewId !== null) {
        const alvo = await db.getFirstAsync("SELECT review FROM movie_reviews WHERE id = ?;", [editingReviewId]);
        if (alvo) {
          const partes = alvo.review.split('➡️[RESP_START]');
          const textoPrincipal = partes[0];
          
          let novoTextoReview = textoPrincipal;
          for (let i = 1; i < partes.length; i++) {
            const blocoFechado = partes[i].split('[RESP_END]');
            if (i === editingReplyIndex) {
              let dadosVelhos = blocoFechado[0].split('||');
              let autorId = dadosVelhos[0] || AuthSession.userId;
              let autorNome = dadosVelhos[1] || nomeDoAutorLogado;
              let data = dadosVelhos[2] || new Date().toLocaleDateString('pt-BR');

              novoTextoReview += `➡️[RESP_START]${autorId}||${autorNome}||${data}||${review.trim()}||${fotoDoAutorLogado}||${corDoAutorLogado}||${iconeDoAutorLogado}[RESP_END]${blocoFechado[1] || ''}`;
            } else {
              novoTextoReview += `➡️[RESP_START]${blocoFechado[0]}[RESP_END]${blocoFechado[1] || ''}`;
            }
          }

          await db.runAsync("UPDATE movie_reviews SET review = ? WHERE id = ?;", [novoTextoReview, editingReviewId]);
          Alert.alert("Sucesso!", "Resposta atualizada!");
        }
      } 
      else if (replyTarget) {
        const alvo = await db.getFirstAsync("SELECT review FROM movie_reviews WHERE id = ?;", [replyTarget.id]);
        if (alvo) {
          const dataAtual = new Date().toLocaleDateString('pt-BR');
          const textoComResposta = `${alvo.review}\n➡️[RESP_START]${AuthSession.userId}||${nomeDoAutorLogado}||${dataAtual}||${review.trim()}||${fotoDoAutorLogado}||${corDoAutorLogado}||${iconeDoAutorLogado}[RESP_END]`;
          
          await db.runAsync("UPDATE movie_reviews SET review = ? WHERE id = ?;", [textoComResposta, replyTarget.id]);
          Alert.alert("Sucesso!", "Sua resposta foi adicionada!");
        }
      } 
      else if (editingReviewId !== null) {
        const alvo = await db.getFirstAsync("SELECT review FROM movie_reviews WHERE id = ?;", [editingReviewId]);
        if (alvo) {
          const partes = alvo.review.split('➡️[RESP_START]');
          let novasSubRespostas = "";
          if (partes.length > 1) {
            novasSubRespostas = "\n➡️[RESP_START]" + partes.slice(1).join('➡️[RESP_START]');
          }
          const textoFinalAtualizado = review.trim() + novasSubRespostas;

          await db.runAsync("UPDATE movie_reviews SET rating = ?, review = ? WHERE id = ?;", [rating, textoFinalAtualizado, editingReviewId]);
          Alert.alert("Sucesso!", "Seu comentário foi updated.");
        }
      } 
      else {
        await db.runAsync("INSERT INTO movie_reviews (user_id, movie_id, rating, review) VALUES (?, ?, ?, ?);", [AuthSession.userId, id, rating, review.trim()]);
        await db.runAsync("INSERT OR IGNORE INTO user_movies (user_id, movie_id, watched, rating, review) VALUES (?, ?, 1, ?, '');", [AuthSession.userId, id, rating]);
      }

      setWatched(true);
      resetarFormulario();
      carregarDadosCompletos();
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível salvar.");
    }
  }

  function iniciarEdicao(reviewId, textoBrutoCompleto, notaAntiga) {
    setEditingReviewId(reviewId);
    setReplyTarget(null);
    setEditingReplyIndex(null);
    const partes = textoBrutoCompleto.split('➡️[RESP_START]');
    setReview(partes[0].trim());
    setRating(notaAntiga);
  }

  function iniciarEdicaoDaResposta(reviewId, indexDimensao, textoMensagem) {
    setEditingReviewId(reviewId);
    setEditingReplyIndex(indexDimensao);
    setReplyTarget(null);
    setReview(textoMensagem.trim()); 
  }

  async function handleRemoverSubResposta(reviewId, indexDimensao, autorResposta) {
    Alert.alert("Remover Resposta", `Deseja apagar a resposta de @${autorResposta}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            const alvo = await db.getFirstAsync("SELECT review FROM movie_reviews WHERE id = ?;", [reviewId]);
            if (alvo) {
              const partes = alvo.review.split('➡️[RESP_START]');
              const textoPrincipal = partes[0];
              
              let novoTextoReview = textoPrincipal;
              for (let i = 1; i < partes.length; i++) {
                const blocoFechado = partes[i].split('[RESP_END]');
                if (i !== indexDimensao) {
                  novoTextoReview += `➡️[RESP_START]${blocoFechado[0]}[RESP_END]${blocoFechado[1] || ''}`;
                } else {
                  novoTextoReview += blocoFechado[1] || '';
                }
              }

              await db.runAsync("UPDATE movie_reviews SET review = ? WHERE id = ?;", [novoTextoReview, reviewId]);
              Alert.alert("Sucesso", "Resposta removida!");
              resetarFormulario();
              carregarDadosCompletos();
            }
          } catch (error) {
            console.error(error);
          }
        }
      }
    ]);
  }

  function iniciarResposta(comentarioAlvo) {
    setReplyTarget(comentarioAlvo);
    setEditingReviewId(null);
    setEditingReplyIndex(null);
    setReview("");
    Alert.alert("Respondendo", `Adicionando uma resposta para @${comentarioAlvo.autor_nome}`);
  }

  function resetarFormulario() {
    setEditingReviewId(null);
    setReplyTarget(null);
    setEditingReplyIndex(null);
    setReview("");
    setRating(0);
  }

  async function handleRemoverComentario(reviewId, autorComentario) {
    Alert.alert("Remover", `Deseja apagar este comentário de @${autorComentario}? (Isso apagará todas as sub-respostas vinculadas)`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar Tudo",
        style: "destructive",
        onPress: async () => {
          try {
            await db.runAsync("DELETE FROM movie_reviews WHERE id = ?;", [reviewId]);
            Alert.alert("Sucesso", "Comentário removido!");
            resetarFormulario();
            carregarDadosCompletos();
          } catch (error) {
            console.error(error);
          }
        }
      }
    ]);
  }

  function renderizarTextoERespostas(reviewId, reviewRaw) {
    if (!reviewRaw) return null;

    const partes = reviewRaw.split('➡️[RESP_START]');
    const textoPrincipal = partes[0];
    const respostasFinais = [];

    for (let i = 1; i < partes.length; i++) {
      const blocoFechado = partes[i].split('[RESP_END]');
      if (blocoFechado[0]) {
        let dadosSub = blocoFechado[0].split('||');
        
        let idDono = dadosSub[0] ? parseInt(dadosSub[0]) : null;
        let autor = dadosSub[1] || "Usuário";
        let data = dadosSub[2] || "";
        let msg = dadosSub[3] || "";
        let foto = dadosSub[4] || null;
        let cor = dadosSub[5] || null;
        let icone = dadosSub[6] || null;

        respostasFinais.push({ 
          indiceReal: i, 
          idDono, autor, data, msg, foto, cor, icone
        });
      }
    }

    return (
      <View style={{ width: '100%' }}>
        <Text style={globalStyles.commentBaseText}>{textoPrincipal}</Text>
        
        {respostasFinais.length > 0 && (
          <View style={globalStyles.subRepliesTreeContainer}>
            {respostasFinais.map((resp) => {
              const minhaSubResposta = resp.idDono === AuthSession.userId;
              const podeEditarSub = minhaSubResposta;
              const podeDeletarSub = isAdmin || minhaSubResposta;

              // Renderização condicional dos dados do autor da sub-resposta, priorizando os dados do usuário logado se for o autor
              const fotoExibicao = minhaSubResposta && user ? user.image : resp.foto;
              const corExibicao = minhaSubResposta && user ? user.avatar_color : resp.cor;
              const iconeExibicao = minhaSubResposta && user ? user.avatar_icon : resp.icone;
              const nomeExibicao = minhaSubResposta && user ? user.name : resp.autor;

              return (
                <View key={resp.indiceReal} style={globalStyles.replyCard}>
                  
                  {renderAvatar(fotoExibicao, corExibicao, iconeExibicao, globalStyles.replyAvatar, globalStyles.replyAvatarPlaceholder, 13)}

                  <View style={globalStyles.replyContentBox}>
                    <View style={globalStyles.replyHeaderRow}>
                      <Text style={globalStyles.replyAuthorName} numberOfLines={1}>@{nomeExibicao}</Text>
                      
                      <View style={globalStyles.replyMetaControls}>
                        <Text style={globalStyles.replyDateText}>{resp.data}</Text>
                        
                        {podeEditarSub && (
                          <TouchableOpacity onPress={() => iniciarEdicaoDaResposta(reviewId, resp.indiceReal, resp.msg)} style={globalStyles.replyActionTouch}>
                            <MaterialCommunityIcons name="pencil" size={13} color="#FFD700" />
                          </TouchableOpacity>
                        )}

                        {podeDeletarSub && (
                          <TouchableOpacity onPress={() => handleRemoverSubResposta(reviewId, resp.indiceReal, resp.autor)} style={globalStyles.replyActionTouch}>
                            <MaterialCommunityIcons name="trash-can" size={13} color="#FF6B6B" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text style={globalStyles.replyBodyText}>{resp.msg}</Text>
                  </View>

                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[globalStyles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: Theme.colors.background }} contentContainerStyle={{ paddingBottom: 50 }}>
      
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={globalStyles.detailsHeader}>
        {movie?.poster_path && (
          <Image source={{ uri: `https://image.tmdb.org/t/p/w500${movie.poster_path}` }} style={globalStyles.detailsPosterBlur} resizeMode="cover"/>
        )}
        <TouchableOpacity style={globalStyles.detailsBackButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={globalStyles.detailsContent}>
        
        <View style={{ width: '100%', marginBottom: 15 }}>
          
          <Text 
            style={{ 
              fontSize: obterTamanhoFonteTitulo(movie?.title), 
              lineHeight: obterTamanhoFonteTitulo(movie?.title) + 6,
              marginBottom: 12,
              color: '#00D2FF', 
              fontWeight: 'bold',
              flexWrap: 'wrap',
              width: '100%',
            }}
          >
            {movie?.title || "Carregando..."}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', width: '100%' }}>
            {movie?.poster_path ? (
              <Image source={{ uri: `https://image.tmdb.org/t/p/w200${movie.poster_path}` }} style={globalStyles.movieHeaderPoster} />
            ) : (
              <View style={[globalStyles.movieHeaderPoster, { backgroundColor: '#21262D', justifyContent: 'center', alignItems: 'center' }]}>
                <MaterialCommunityIcons name="movie-open-play" size={40} color={Theme.colors.textSecondary} />
              </View>
            )}
            
            <View style={{ flex: 1, marginLeft: 15, justifyContent: 'center' }}>
              <TouchableOpacity 
                onPress={() => toggleAssistido()} 
                style={[
                  globalStyles.watchButton, 
                  { 
                    backgroundColor: watched ? '#1F6FEB' : '#21262D', 
                    borderColor: watched ? '#1F6FEB' : '#30363D',
                    alignSelf: 'flex-start',
                    marginBottom: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6
                  }
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name={watched ? "eye" : "eye-off"} size={14} color="#FFF" />
                  <Text style={globalStyles.watchButtonText}>{watched ? "ASSISTIDO" : "ASSISTIR"}</Text>
                </View>
              </TouchableOpacity>

              <Text style={[globalStyles.movieYear, { marginBottom: 6, color: '#FFF' }]}>
                Ano: {movie?.release_date ? movie.release_date.split('-')[0] : 'N/A'}
              </Text>
              
              {movieDetails.runtime && (
                <Text style={[globalStyles.movieDetailMetaText, { color: '#AAA' }]}>
                  🕒 Duração: {movieDetails.runtime}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Categorias / Gêneros */}
        {movieDetails.genres.length > 0 && (
          <View style={globalStyles.genresWrapper}>
            {movieDetails.genres.map((genre, gIdx) => (
              <View key={gIdx} style={globalStyles.genreBadge}>
                <Text style={globalStyles.genreBadgeText}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[globalStyles.sectionTitle, { fontSize: 16, marginBottom: 6 }]}>Sinopse</Text>
        <Text style={[globalStyles.movieOverview, { fontSize: 14, lineHeight: 20, marginBottom: 20 }]}>{movie?.overview || "Sinopse não disponível."}</Text>

        <View style={globalStyles.apiDetailsBox}>
          <Text style={globalStyles.apiDetailsText}>🎬 <Text style={globalStyles.apiDetailsLabel}>Diretor:</Text> {movieDetails.director}</Text>
          <Text style={globalStyles.apiDetailsText}>✍️ <Text style={globalStyles.apiDetailsLabel}>Escritor:</Text> {movieDetails.writer}</Text>
          <Text style={globalStyles.apiDetailsText}>🌐 <Text style={globalStyles.apiDetailsLabel}>Idioma Original:</Text> {movieDetails.originalLanguage}</Text>
          <Text style={globalStyles.apiDetailsText}>💰 <Text style={globalStyles.apiDetailsLabel}>Orçamento:</Text> {formatarMoeda(movieDetails.budget)}</Text>
          <Text style={globalStyles.apiDetailsText}>📈 <Text style={globalStyles.apiDetailsLabel}>Bilheteria:</Text> {formatarMoeda(movieDetails.revenue)}</Text>
          <Text style={globalStyles.apiDetailsText}>📌 <Text style={globalStyles.apiDetailsLabel}>Estado:</Text> {movieDetails.status}</Text>
        </View>

        {/* Elenco */}
        {movieDetails.cast.length > 0 && (
          <View style={globalStyles.castWrapper}>
            <Text style={[globalStyles.sectionTitle, { fontSize: 16, marginBottom: 12 }]}>Elenco Principal</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={globalStyles.castScrollContainer}>
              {movieDetails.cast.map((actor, aIdx) => (
                <View key={aIdx} style={globalStyles.castActorCard}>
                  {actor.profile_path ? (
                    <Image source={{ uri: actor.profile_path }} style={globalStyles.castActorImage} />
                  ) : (
                    <View style={globalStyles.castActorPlaceholder}>
                      <MaterialCommunityIcons name="account" size={32} color={Theme.colors.textSecondary} />
                    </View>
                  )}
                  <Text style={globalStyles.castActorName} numberOfLines={2}>{actor.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={globalStyles.dividerLine} />

        {/* Formulário de Envio */}
        <Text style={[globalStyles.sectionTitle, globalStyles.formTitle]}>
          {replyTarget ? `💬 Respondendo a @${replyTarget.autor_nome}` : editingReplyIndex !== null ? "📝 Editando Sua Resposta" : editingReviewId !== null ? "📝 Editando Comentário Base" : "Deixe um novo Comentário"}
        </Text>
        
        {(!replyTarget && editingReplyIndex === null) && (
          <View style={globalStyles.starContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={globalStyles.starSpacing}>
                <MaterialCommunityIcons name={star <= rating ? "star" : "star-outline"} size={32} color={star <= rating ? "#FFD700" : Theme.colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TextInput
          style={[globalStyles.input, globalStyles.formInputMultiline]}
          placeholder={replyTarget ? "Escreva sua resposta para esta thread..." : "Digite aqui o seu comentário..."}
          placeholderTextColor={Theme.colors.textSecondary}
          multiline
          value={review}
          onChangeText={setReview}
        />

        <View style={globalStyles.formActionsWrapper}>
          <TouchableOpacity 
            style={[
              globalStyles.submitButton, 
              { 
                backgroundColor: replyTarget ? "#1F6FEB" : (editingReviewId !== null || editingReplyIndex !== null) ? "#FFD700" : Theme.colors.primary, 
              }
            ]}
            onPress={handleSalvarAvaliacao}
          >
            <Text style={[globalStyles.submitButtonText, { color: replyTarget ? '#FFF' : '#000' }]}>
              {replyTarget ? "Publicar Resposta" : (editingReviewId !== null || editingReplyIndex !== null) ? "Salvar Alterações" : "Publicar Comentário"}
            </Text>
          </TouchableOpacity>

          {(editingReviewId !== null || replyTarget !== null || editingReplyIndex !== null) && (
            <TouchableOpacity style={globalStyles.cancelButton} onPress={resetarFormulario}>
              <Text style={globalStyles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[globalStyles.dividerLine, { marginTop: 25, marginBottom: 20 }]} />

        {/* Mural de Comentários */}
        <Text style={[globalStyles.sectionTitle, globalStyles.muralTitle]}>💬 Mural de Discussão ({allReviews.length})</Text>

        {allReviews.length === 0 ? (
          <Text style={globalStyles.muralEmptyText}>Nenhum comentário enviado ainda. Comece a discussão!</Text>
        ) : (
          allReviews.map((item) => {
            const eDonoDoComentario = item.user_id === AuthSession.userId;
            const podeEditarComentarioBase = eDonoDoComentario;
            const podeDeletar = isAdmin || eDonoDoComentario;

            return (
              <View key={item.id} style={globalStyles.commentCard}>
                
                <View style={globalStyles.commentHeader}>
                  <View style={globalStyles.commentAuthorBox}>
                    
                    {renderAvatar(item.autor_foto, item.autor_cor, item.autor_icone, globalStyles.commentAuthorAvatar, globalStyles.commentAuthorPlaceholder, 18)}
                    
                    <View style={globalStyles.commentAuthorNameRow}>
                      <Text style={globalStyles.commentAuthorName} numberOfLines={1}>@{item.autor_nome}</Text>
                      {eDonoDoComentario && <Text style={globalStyles.commentOwnerBadge}>Você</Text>}
                    </View>
                  </View>

                  <View style={globalStyles.commentControlsRow}>
                    <View style={globalStyles.commentStarsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <MaterialCommunityIcons key={s} name="star" size={12} color={s <= item.rating ? "#FFD700" : '#30363D'} />
                      ))}
                    </View>

                    <View style={globalStyles.commentActionsBox}>
                      <TouchableOpacity onPress={() => iniciarResposta(item)} style={globalStyles.actionIconTouch}>
                        <MaterialCommunityIcons name="comment-outline" size={18} color="#1F6FEB" />
                      </TouchableOpacity>

                      {podeEditarComentarioBase && (
                        <TouchableOpacity onPress={() => iniciarEdicao(item.id, item.review, item.rating)} style={globalStyles.actionIconTouch}>
                          <MaterialCommunityIcons name="pencil-outline" size={18} color="#FFD700" />
                        </TouchableOpacity>
                      )}

                      {podeDeletar && (
                        <TouchableOpacity onPress={() => handleRemoverComentario(item.id, item.autor_nome)} style={globalStyles.actionIconTouch}>
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color={isAdmin && !eDonoDoComentario ? "#FF6B6B" : Theme.colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                {renderizarTextoERespostas(item.id, item.review)}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}