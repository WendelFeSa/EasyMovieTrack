import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Theme } from '../constants/theme';
import { AuthSession } from '../src/services/authSession';
import { globalStyles } from '../src/styles/globalStyles';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const db = useSQLiteContext();
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      return Alert.alert("Erro", "Preencha todos os campos.");
    }
    
    try {
      const emailLimpo = email.trim().toLowerCase();

      // Transforma a senha digitada em Hash SHA-256
      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password.trim()
      );

      // Consulta de credenciais seguras
      const user = await db.getFirstAsync(
        'SELECT * FROM users WHERE email = ? AND password = ?',
        [emailLimpo, hashedPassword]
      );
      
      if (user) {
        // Alimenta a sessão estática global do app de forma segura
        AuthSession.userId = user.id;
        AuthSession.userEmail = user.email;
        AuthSession.role = user.role; 

        console.log(`Usuário conectado: ID: ${user.id}, Cargo: ${user.role}`);

        // Navega para a aba do perfil limpando o histórico de login da pilha
        router.replace('/(tabs)/profile'); 
      } else {
        Alert.alert("Erro", "E-mail ou senha incorretos.");
      }
    } catch (error) {
      Alert.alert("Erro", "Erro ao acessar o banco de dados.");
    }
  }

  return (
    <View style={globalStyles.safeArea}>
      <Text style={globalStyles.title}>EASY MOVIE TRACK</Text>
      
      <TextInput 
        style={globalStyles.input} 
        placeholder="E-mail" 
        placeholderTextColor={Theme.colors.textSecondary} 
        onChangeText={setEmail} 
        autoCapitalize="none" 
        keyboardType="email-address"
        value={email} 
      />
      <TextInput 
        style={globalStyles.input} 
        placeholder="Senha" 
        placeholderTextColor={Theme.colors.textSecondary} 
        onChangeText={setPassword} 
        secureTextEntry 
        value={password} 
      />

      <TouchableOpacity style={globalStyles.buttonPrimary} onPress={handleLogin}>
        <Text style={globalStyles.buttonText}>Entrar</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => router.push('/forgot-password')}>
        <Text style={globalStyles.linkText}>Esqueceu a senha?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/register')}>
        <Text style={globalStyles.linkText}>Não tem conta? Cadastre-se</Text>
      </TouchableOpacity>
    </View>
  );
}