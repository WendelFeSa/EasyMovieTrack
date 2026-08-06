import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { Theme } from '../../constants/theme';
import { getActorDetails, getActorMovieCredits } from '../../src/services/api';
import { globalStyles } from '../../src/styles/globalStyles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ActorDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [actor, setActor] = useState(null);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para controlar a foto em tela cheia
  const [imageModalVisible, setImageModalVisible] = useState(false);

  useEffect(() => {
    async function carregarDadosAtor() {
      try {
        setLoading(true);
        const [detalhesAtor, listaFilmes] = await Promise.all([
          getActorDetails(id),
          getActorMovieCredits(id)
        ]);

        setActor(detalhesAtor);
        setMovies(listaFilmes || []);
      } catch (error) {
        console.error("Erro ao carregar perfil do ator:", error);
      } finally {
        setLoading(false);
      }
    }

    if (id) carregarDadosAtor();
  }, [id]);

  if (loading) {
    return (
      <View style={[globalStyles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  // ✨ CORREÇÃO DA URL: Usando w500 para garantir o carregamento correto da imagem do TMDB
  const profileUri = actor?.profile_path 
    ? `https://image.tmdb.org/t/p/w500${actor.profile_path}` 
    : null;

  return (
    <ScrollView style={{ backgroundColor: Theme.colors.background }} contentContainerStyle={{ paddingBottom: 50 }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header com Botão de Voltar */}
      <View style={{ position: 'relative', width: '100%' }}>
        <TouchableOpacity 
          style={[globalStyles.detailsBackButton, { top: 45, left: 20, zIndex: 10 }]} 
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={Theme.colors.text || '#FFF'} />
        </TouchableOpacity>
      </View>

      {/* Perfil e Foto Clicável */}
      <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 }}>
        <TouchableOpacity 
          activeOpacity={0.8} 
          onPress={() => profileUri && setImageModalVisible(true)}
          style={{ position: 'relative' }}
        >
          {profileUri ? (
            <Image 
              source={{ uri: profileUri }} 
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                borderWidth: 3,
                borderColor: '#00D2FF',
                backgroundColor: '#21262D'
              }} 
            />
          ) : (
            <View style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: '#21262D',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: Theme.colors.textSecondary
            }}>
              <MaterialCommunityIcons name="account" size={70} color={Theme.colors.textSecondary} />
            </View>
          )}

          {profileUri && (
            <View style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              backgroundColor: 'rgba(0,0,0,0.75)',
              padding: 6,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#00D2FF'
            }}>
              <MaterialCommunityIcons name="magnify-plus-outline" size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={[globalStyles.sectionTitle, { fontSize: 22, marginTop: 15, textAlign: 'center' }]}>
          {actor?.name}
        </Text>
        
        {actor?.known_for_department && (
          <View style={[globalStyles.genreBadge, { marginTop: 6, backgroundColor: 'rgba(0, 210, 255, 0.15)' }]}>
            <Text style={[globalStyles.genreBadgeText, { color: '#00D2FF' }]}>{actor.known_for_department}</Text>
          </View>
        )}
      </View>

      {/* Informações Pessoais */}
      <View style={[globalStyles.apiDetailsBox, { marginHorizontal: 20, marginTop: 20 }]}>
        {actor?.birthday && (
          <Text style={globalStyles.apiDetailsText}>
            🎂 <Text style={globalStyles.apiDetailsLabel}>Nascimento:</Text> {actor.birthday}
          </Text>
        )}
        {actor?.place_of_birth && (
          <Text style={globalStyles.apiDetailsText}>
            📍 <Text style={globalStyles.apiDetailsLabel}>Local:</Text> {actor.place_of_birth}
          </Text>
        )}
      </View>

      {/* Biografia sem Cortes */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <Text style={[globalStyles.sectionTitle, { fontSize: 16, marginBottom: 8 }]}>Biografia</Text>
        <Text style={{ fontSize: 14, lineHeight: 22, color: Theme.colors.textSecondary || '#C9D1D9', textAlign: 'justify' }}>
          {actor?.biography || "Biografia não informada."}
        </Text>
      </View>

      {/* Filmografia do Ator */}
      {movies.length > 0 && (
        <View style={[globalStyles.castWrapper, { marginTop: 25 }]}>
          <Text style={[globalStyles.sectionTitle, { fontSize: 16, marginBottom: 12, paddingHorizontal: 20 }]}>
            Filmografia ({movies.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={globalStyles.castScrollContainer}>
            {movies.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={globalStyles.castActorCard}
                onPress={() => router.push(`/movie/${item.id}`)}
              >
                {item.poster_path ? (
                  <Image 
                    source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }} 
                    style={globalStyles.castActorImage} 
                  />
                ) : (
                  <View style={globalStyles.castActorPlaceholder}>
                    <MaterialCommunityIcons name="movie-open-play" size={30} color={Theme.colors.textSecondary} />
                  </View>
                )}
                <Text style={globalStyles.castActorName} numberOfLines={2}>{item.title}</Text>
                {item.character ? (
                  <Text style={{ fontSize: 10, color: Theme.colors.textSecondary, textAlign: 'center', marginTop: 2 }} numberOfLines={1}>
                    como {item.character}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Modal de Zoom da Foto em Tela Cheia */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setImageModalVisible(false)}>
          <View style={localStyles.modalOverlay}>
            <TouchableOpacity 
              style={localStyles.closeModalButton} 
              onPress={() => setImageModalVisible(false)}
            >
              <MaterialCommunityIcons name="close" size={26} color="#FFF" />
            </TouchableOpacity>

            {profileUri && (
              <Image 
                source={{ uri: profileUri }} 
                style={localStyles.fullScreenImage} 
                resizeMode="contain" 
              />
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButton: {
    position: 'absolute',
    top: 45,
    right: 20,
    zIndex: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 20,
  },
  fullScreenImage: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
  },
});