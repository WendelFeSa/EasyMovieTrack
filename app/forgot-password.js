import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Theme } from '../constants/theme';
import { globalStyles } from '../src/styles/globalStyles';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const db = useSQLiteContext();
  const router = useRouter();

  async function handleResetPassword() {
    const emailLimpo = email.trim().toLowerCase();
    const senhaLimpa = newPassword.trim();

    if (!emailLimpo || !senhaLimpa) {
      Alert.alert("Erro", "Preencha todos os campos!");
      return;
    }

    if (senhaLimpa.length < 6) {
      Alert.alert("Erro", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      const user = await db.getFirstAsync('SELECT id FROM users WHERE email = ?', [emailLimpo]);

      if (!user) {
        Alert.alert("Erro", "Este e-mail não está cadastrado.");
        return;
      }

      // Criptografia segura SHA-256 antes da persistência
      const hashedNewPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        senhaLimpa
      );

      await db.runAsync('UPDATE users SET password = ? WHERE email = ?', [hashedNewPassword, emailLimpo]);

      Alert.alert("Sucesso", "Senha redefinida com sucesso!");
      router.replace('/'); 
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Ocorreu um erro ao redefinir a senha.");
    }
  }

  return (
    <View style={globalStyles.safeArea}>
      <Text style={globalStyles.title}>RECUPERAR</Text>
      
      <TextInput 
        style={globalStyles.input} 
        placeholder="E-mail cadastrado" 
        placeholderTextColor={Theme.colors.textSecondary} 
        onChangeText={setEmail}
        autoCapitalize="none" 
        keyboardType="email-address"
        value={email}
      />
      
      <TextInput 
        style={globalStyles.input} 
        placeholder="Nova Senha" 
        placeholderTextColor={Theme.colors.textSecondary} 
        secureTextEntry 
        onChangeText={setNewPassword}
        value={newPassword}
      />
      
      <TouchableOpacity style={globalStyles.buttonPrimary} onPress={handleResetPassword}>
        <Text style={globalStyles.buttonText}>Atualizar Senha</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={globalStyles.linkText}>Voltar ao Login</Text>
      </TouchableOpacity>
    </View>
  );
}