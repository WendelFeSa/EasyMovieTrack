import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/theme';
import { globalStyles } from '../../src/styles/globalStyles';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const db = useSQLiteContext();

  const [userInfo, setUserInfo] = useState(null);
  const [favoriteMovies, setFavoriteMovies] = useState([]);
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para o Modal de Ampliação de Foto
  const [modalImageVisible, setModalImageVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(null);

  useEffect(() => {
    async function carregarPerfil() {
      try {
        if (!id) return;

        setLoading(true);

        // 1. Dados do Usuário (incluindo o cargo/role)
        const user = await db.getFirstAsync(
          "SELECT id, name, email, image, avatar_color, avatar_icon, role FROM users WHERE id = ?;",
          [id]
        );
        setUserInfo(user);

        if (user?.image && user.image !== "NULO") {
          setSelectedImageUri(user.image);
        }

        // 2. Garantir que a tabela de favoritos exista (evita erro/log de aviso)
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS user_favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            movie_id INTEGER NOT NULL,
            UNIQUE(user_id, movie_id)
          );
        `);

        // 3. Filmes Assistidos pelo Usuário
        const assistidos = await db.getAllAsync(
          `SELECT m.id, m.title, m.poster_path 
           FROM user_movies um
           INNER JOIN movies m ON um.movie_id = m.id
           WHERE um.user_id = ? AND um.watched = 1;`,
          [id]
        );
        setWatchedMovies(assistidos);

        // 4. Filmes Favoritos
        const favoritos = await db.getAllAsync(
          `SELECT m.id, m.title, m.poster_path 
           FROM user_favorites uf
           INNER JOIN movies m ON uf.movie_id = m.id
           WHERE uf.user_id = ?;`,
          [id]
        );
        setFavoriteMovies(favoritos);

      } catch (error) {
        console.error("Erro ao carregar perfil do usuário:", error);
      } finally {
        setLoading(false);
      }
    }

    carregarPerfil();
  }, [id]);

  const renderAvatar = () => {
    if (userInfo?.image && userInfo.image !== "NULO" && userInfo.image !== "undefined" && (userInfo.image.startsWith('http') || userInfo.image.startsWith('file') || userInfo.image.startsWith('content'))) {
      return (
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={() => setModalImageVisible(true)}
          style={{ width: 100, height: 100, borderRadius: 50, overflow: 'hidden', borderWidth: 3, borderColor: Theme.colors.primary }}
        >
          <Image 
            source={{ uri: userInfo.image }} 
            style={{ width: '100%', height: '100%' }} 
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }

    const corFundo = userInfo?.avatar_color || Theme.colors.primary;
    const nomeIcone = userInfo?.avatar_icon || 'account';

    return (
      <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: corFundo, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'transparent' }}>
        <MaterialCommunityIcons name={nomeIcone} size={50} color="#FFF" />
      </View>
    );
  };

  const renderMovieCard = ({ item }) => (
    <TouchableOpacity 
      style={{ marginRight: 12, width: 110 }} 
      onPress={() => router.push(`/movie/${item.id}`)}
    >
      {item.poster_path ? (
        <Image 
          source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }} 
          style={{ width: 110, height: 160, borderRadius: 8, backgroundColor: '#21262D' }} 
        />
      ) : (
        <View style={{ width: 110, height: 160, borderRadius: 8, backgroundColor: '#21262D', justifyContent: 'center', alignItems: 'center' }}>
          <MaterialCommunityIcons name="movie-open" size={32} color="#8B949E" />
        </View>
      )}
      <Text numberOfLines={1} style={{ color: '#C9D1D9', fontSize: 12, marginTop: 4, fontWeight: '500' }}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  const formatarCargo = (role) => {
    if (role === 'admin') return 'Administrador';
    return 'Membro da comunidade';
  };

  if (loading) {
    return (
      <View style={[globalStyles.safeArea, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D1117' }]}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  if (!userInfo) {
    return (
      <View style={[globalStyles.safeArea, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D1117', padding: 20 }]}>
        <Stack.Screen options={{ title: 'Perfil', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#161B22' } }} />
        <MaterialCommunityIcons name="account-remove" size={60} color="#8B949E" />
        <Text style={{ color: '#FFF', fontSize: 18, marginTop: 12 }}>Usuário não encontrado.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0D1117' }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen 
        options={{ 
          title: `@${userInfo.name}`, 
          headerTintColor: '#FFF', 
          headerStyle: { backgroundColor: '#161B22' },
          headerBackTitle: 'Voltar'
        }} 
      />

      {/* Modal de Foto em Tamanho Cheio */}
      <Modal
        visible={modalImageVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalImageVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.9)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 }}
            onPress={() => setModalImageVisible(false)}
          >
            <MaterialCommunityIcons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>

          {selectedImageUri && (
            <Image
              source={{ uri: selectedImageUri }}
              style={{ width: '90%', height: '70%', borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Cartão de Cabeçalho do Perfil */}
      <View style={{ alignItems: 'center', backgroundColor: '#161B22', padding: 20, borderRadius: 12, marginBottom: 20 }}>
        {renderAvatar()}
        <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>{userInfo.name}</Text>
        
        {/* Cargo do Usuário */}
        <Text style={{ 
          color: userInfo.role === 'admin' ? '#FFD700' : '#8B949E', 
          fontSize: 13, 
          marginTop: 2,
          fontWeight: userInfo.role === 'admin' ? 'bold' : 'normal'
        }}>
          {formatarCargo(userInfo.role)}
        </Text>
      </View>

      {/* Lista de Favoritos */}
      {favoriteMovies.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
            ⭐ Favoritos ({favoriteMovies.length})
          </Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={favoriteMovies}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMovieCard}
          />
        </View>
      )}

      {/* Lista de Assistidos */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
          👁️ Filmes Assistidos ({watchedMovies.length})
        </Text>
        {watchedMovies.length === 0 ? (
          <View style={{ backgroundColor: '#161B22', padding: 16, borderRadius: 8, alignItems: 'center' }}>
            <MaterialCommunityIcons name="eye-off-outline" size={24} color="#8B949E" style={{ marginBottom: 8 }}/>
            <Text style={{ color: '#8B949E', fontSize: 14, textAlign: 'center' }}>Nenhum filme marcado como assistido ainda.</Text>
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={watchedMovies}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMovieCard}
          />
        )}
      </View>
    </ScrollView>
  );
}