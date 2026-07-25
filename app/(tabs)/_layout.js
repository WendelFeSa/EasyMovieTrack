import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Theme } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.primary, 
        tabBarInactiveTintColor: Theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Theme.colors.background,
          borderTopColor: '#1E252E',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontWeight: 'bold',
          fontSize: 12,
        },
      }}
    >
      {/* ABA PRINCIPAL DE FILMES */}
      <Tabs.Screen
        name="movies"
        options={{
          title: 'CineStorm',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="weather-lightning" size={size} color={color} />
          ),
        }}
      />
      {/* NOVA ABA DO HISTÓRICO DE FILMES ASSISTIDOS */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="eye-check-outline" size={size} color={color} />
          ),
        }}
      />
      {/* ABA DE PERFIL/AVATAR */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Avatar',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="flash-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}