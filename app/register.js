import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Theme } from '../constants/theme';
import { globalStyles } from '../src/styles/globalStyles';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const db = useSQLiteContext();
  const router = useRouter();

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert("Erro", "Preencha todos os campos!");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Erro", "Por favor, insira um e-mail em formato válido.");
      return;
    }

    if (password.trim().length < 6) {
      Alert.alert("Erro", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      const nomeLimpo = name.trim();
      const emailLimpo = email.trim().toLowerCase();

      // Criptografia da senha para o banco de dados
      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password.trim()
      );

      await db.runAsync(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [nomeLimpo, emailLimpo, hashedPassword, 'comum']
      );
      
      Alert.alert("Sucesso", "Usuário cadastrado com sucesso!");
      router.replace('/'); 
    } catch (error) {
      Alert.alert("Erro", "E-mail já cadastrado ou erro no banco.");
    }
  }

  return (
    <View style={globalStyles.safeArea}>
      <Text style={globalStyles.title}>CRIAR CONTA</Text>
      
      <TextInput 
        style={globalStyles.input} 
        placeholder="Nome" 
        placeholderTextColor={Theme.colors.textSecondary} 
        onChangeText={setName} 
        value={name} 
      />
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

      <TouchableOpacity style={globalStyles.buttonPrimary} onPress={handleRegister}>
        <Text style={globalStyles.buttonText}>Cadastrar</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={globalStyles.linkText}>Voltar para o Login</Text>
      </TouchableOpacity>
    </View>
  );
}