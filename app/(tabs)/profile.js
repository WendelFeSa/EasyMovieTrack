import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Theme } from '../../constants/theme';
import { AuthSession } from '../../src/services/authSession';
import { globalStyles } from '../../src/styles/globalStyles';

const COLORS = ['#00E5FF', '#7B61FF', '#FFFFFF', '#4CC9FE', '#3F72AF', '#2D333B'];
const ICONS = ['weather-lightning', 'flash', 'weather-pouring', 'movie-roll', 'popcorn', 'star'];

export default function Profile() {
  const router = useRouter();
  const db = useSQLiteContext();
  const params = useLocalSearchParams();

  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [selectedColor, setSelectedColor] = useState(Theme.colors.primary);
  const [selectedIcon, setSelectedIcon] = useState('weather-lightning');
  const [userImage, setUserImage] = useState(null);

  // Estado para controlar a visualização da foto em tela cheia
  const [imageModalVisible, setImageModalVisible] = useState(false);

  async function loadUserData() {
    try {
      const emailAlvo = params.userEmail?.trim() || AuthSession.userEmail?.trim();

      if (emailAlvo) {
        const result = await db.getFirstAsync(
          'SELECT name, email, role, avatar_color, avatar_icon, image FROM users WHERE email = ?',
          [emailAlvo]
        );
        if (result) {
          setUser(result);
          setNewName(result.name);
          setSelectedColor(result.avatar_color || Theme.colors.primary);
          setSelectedIcon(result.avatar_icon || 'weather-lightning');
          setUserImage(result.image);
        }
      }
    } catch (error) { 
      console.error("Erro ao carregar dados do usuário:", error); 
    }
  }

  useEffect(() => { 
    loadUserData(); 
  }, [params.userEmail]);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert("Permissão", "Precisamos de acesso à galeria.");
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setUserImage(result.assets[0].uri);
    }
  }

  function handleLogout() {
    Alert.alert("Sair", "Deseja encerrar sessão?", [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Sair", 
        onPress: () => {
          AuthSession.userId = null;
          AuthSession.userEmail = null;
          AuthSession.role = null;
          router.replace('/');
        } 
      }
    ]);
  }

  async function handleUpdateProfile() {
    if (!newName.trim()) return Alert.alert("Erro", "O nome não pode ficar vazio.");

    try {
      let query = `UPDATE users SET name = ?, avatar_color = ?, avatar_icon = ?, image = ?`;
      let values = [newName.trim(), selectedColor, selectedIcon, userImage];

      if (newPassword.trim().length > 0) {
        if (newPassword.length < 6) return Alert.alert("Erro", "Senha muito fraca! Mínimo 6 caracteres.");
        
        const hashedPassword = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          newPassword.trim()
        );

        query += `, password = ?`;
        values.push(hashedPassword);
      }
      
      query += ` WHERE email = ?`;
      values.push(user?.email);

      await db.runAsync(query, values);

      if (user) setUser({ ...user, name: newName.trim(), avatar_color: selectedColor, avatar_icon: selectedIcon, image: userImage });
      setIsEditing(false);
      setNewPassword(''); 
      Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
    } catch (error) { 
      console.error(error);
      Alert.alert("Erro", "Erro ao salvar os dados no banco local."); 
    }
  }

  const handleAvatarPress = () => {
    if (isEditing) {
      pickImage();
    } else {
      setImageModalVisible(true);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: Theme.colors.background }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <View style={globalStyles.headerCenter}>
        
        {/* Clique no Avatar para editar (quando isEditing) ou ampliar (quando visualizando) */}
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
          <View style={[globalStyles.avatarCircle, { backgroundColor: selectedColor, shadowColor: selectedColor }]}>
            {userImage ? (
              <Image source={{ uri: userImage }} style={globalStyles.avatarImage} />
            ) : (
              <MaterialCommunityIcons name={selectedIcon} size={60} color={selectedColor === '#FFFFFF' ? '#000' : 'white'} />
            )}
            {isEditing && (
              <View style={globalStyles.cameraBadge}>
                <MaterialCommunityIcons name="camera" size={18} color="white" />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {user?.role && (
          <Text style={{ color: Theme.colors.primary, fontSize: 11, fontWeight: 'bold', marginBottom: 20, letterSpacing: 1 }}>
            {user.role.toUpperCase()}
          </Text>
        )}

        {isEditing ? (
          <View style={{ width: '100%' }}>
            <TouchableOpacity onPress={() => setUserImage(null)}>
               <Text style={{ color: Theme.colors.danger, textAlign: 'center', marginBottom: 15, fontSize: 12, fontWeight: 'bold' }}>REMOVER FOTO E USAR AVATAR</Text>
            </TouchableOpacity>

            <Text style={globalStyles.labelForm}>COR:</Text>
            <View style={globalStyles.rowFlex}>
              {COLORS.map(color => (
                <TouchableOpacity 
                  key={color} 
                  style={[globalStyles.colorDot, { backgroundColor: color, borderColor: 'white', borderWidth: selectedColor === color ? 2 : 0 }]} 
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <Text style={globalStyles.labelForm}>ÍCONE:</Text>
            <View style={globalStyles.rowFlex}>
              {ICONS.map(icon => (
                <TouchableOpacity 
                  key={icon} 
                  style={[globalStyles.iconBox, { backgroundColor: selectedIcon === icon ? Theme.colors.primary : Theme.colors.surface }]} 
                  onPress={() => setSelectedIcon(icon)}
                >
                  <MaterialCommunityIcons name={icon} size={24} color={selectedIcon === icon ? 'black' : 'white'} />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={globalStyles.input} value={newName} onChangeText={setNewName} placeholder="Nome" placeholderTextColor="#aaa" />
            <TextInput style={globalStyles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Nova Senha" placeholderTextColor="#aaa" />
            
            <TouchableOpacity style={globalStyles.buttonPrimary} onPress={handleUpdateProfile}>
              <Text style={globalStyles.buttonText}>SALVAR TUDO</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[globalStyles.outlineBtn, { borderColor: Theme.colors.textSecondary, marginTop: 10 }]} onPress={() => setIsEditing(false)}>
              <Text style={{ color: Theme.colors.textSecondary, fontWeight: 'bold' }}>CANCELAR EDICÃO</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[globalStyles.title, { marginBottom: 5 }]}>{user?.name || "Carregando..."}</Text>
            <Text style={{ color: Theme.colors.textSecondary, marginBottom: 20 }}>{user?.email}</Text>
            
            <TouchableOpacity style={globalStyles.buttonPrimary} onPress={() => setIsEditing(true)}>
              <Text style={globalStyles.buttonText}>CUSTOMIZAR PERFIL</Text>
            </TouchableOpacity>

            {user?.role === 'admin' && (
              <TouchableOpacity 
                style={[globalStyles.outlineBtn, { borderColor: Theme.colors.primary, marginTop: 10 }]} 
                onPress={() => router.push('/admin-users')}
              >
                <Text style={{ color: Theme.colors.primary, fontWeight: 'bold' }}>GERENCIAR USUÁRIOS</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[globalStyles.outlineBtn, { borderColor: Theme.colors.danger, marginTop: 10 }]} onPress={handleLogout}>
              <Text style={{ color: Theme.colors.danger, fontWeight: 'bold' }}>SAIR DA CONTA</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* MODAL DE AMPLIAÇÃO DA FOTO DE PERFIL */}
      <Modal 
        visible={imageModalVisible} 
        transparent={true} 
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <Pressable 
          style={{
            flex: 1, 
            backgroundColor: 'rgba(0, 0, 0, 0.9)', 
            justifyContent: 'center', 
            alignItems: 'center',
            padding: 20
          }}
          onPress={() => setImageModalVisible(false)}
        >
          <TouchableOpacity 
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }}
            onPress={() => setImageModalVisible(false)}
          >
            <MaterialCommunityIcons name="close" size={30} color="white" />
          </TouchableOpacity>

          <View style={{ width: 280, height: 280, borderRadius: 140, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: selectedColor }}>
            {userImage ? (
              <Image source={{ uri: userImage }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <MaterialCommunityIcons name={selectedIcon} size={140} color={selectedColor === '#FFFFFF' ? '#000' : 'white'} />
            )}
          </View>
        </Pressable>
      </Modal>

    </ScrollView>
  );
}