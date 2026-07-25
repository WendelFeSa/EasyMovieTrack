import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { initializeDatabase } from '../src/database/initializeDatabase';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="easymovie.db" onInit={initializeDatabase}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Cadastro' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Recuperar Senha' }} />
        <Stack.Screen name="admin-users" options={{ title: 'Painel Admin' }} />
      </Stack>
    </SQLiteProvider>
  );
}