import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../constants/theme';
import { AuthSession } from '../src/services/authSession';
import { globalStyles } from '../src/styles/globalStyles';

export default function AdminUsers() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const isAdmin = AuthSession.userEmail?.toLowerCase().includes('admin') || AuthSession.role === 'admin';
    
    if (!isAdmin) {
      Alert.alert("Acesso Negado", "Você não tem permissão para acessar esta área.");
      router.replace('/'); 
    } else {
      loadUsers();
    }
  }, []);

  async function loadUsers() {
    try {
      const result = await db.getAllAsync('SELECT * FROM users WHERE role != "admin" AND email NOT LIKE "%admin%"');
      setUsers(result);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  }

  async function handleDeleteUser(id, name) {
    Alert.alert(
      "Remover Usuário", 
      `Tem certeza que deseja remover ${name} da plataforma?`, 
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Confirmar", 
          style: 'destructive', 
          onPress: async () => {
            try {
              await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
              Alert.alert("Sucesso", "Usuário removido com sucesso.");
              loadUsers(); 
            } catch (error) {
              Alert.alert("Erro", "Não foi possível remover o usuário.");
            }
          }
        }
      ]
    );
  }

  return (
    <View style={globalStyles.safeArea}>
      <View style={globalStyles.headerRowLeft}>
        <TouchableOpacity onPress={() => router.back()} style={globalStyles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={Theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[globalStyles.title, { marginBottom: 0 }]}>PAINEL ADMIN</Text>
      </View>

      <Text style={[globalStyles.linkText, { textAlign: 'left', marginTop: 0, marginBottom: 30 }]}>
        Gerenciamento de usuários.
      </Text>
      
      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={globalStyles.userCardLayout}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[globalStyles.avatarMini, { backgroundColor: item.avatar_color || Theme.colors.primary, overflow: 'hidden' }]}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={globalStyles.avatarImage} />
                ) : (
                  <MaterialCommunityIcons name={item.avatar_icon || 'account'} size={20} color="white" />
                )}
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                <Text style={{ color: '#888', fontSize: 12 }}>{item.email}</Text>
              </View>
            </View>
            
            <TouchableOpacity onPress={() => handleDeleteUser(item.id, item.name)}>
              <MaterialCommunityIcons name="trash-can-outline" size={24} color={Theme.colors.danger} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[globalStyles.linkText, { fontStyle: 'italic', marginTop: 50 }]}>Nenhum usuário comum cadastrado.</Text>
        }
      />

      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: Theme.colors.primary, fontSize: 12, fontWeight: 'bold', opacity: 0.6 }}>
          gerenciado por Comandante (Admin)
        </Text>
      </View>
    </View>
  );
}