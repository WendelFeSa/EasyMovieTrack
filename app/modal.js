import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { globalStyles } from '../src/styles/globalStyles';

export default function ModalScreen() {
  const router = useRouter();

  return (
    <View style={[globalStyles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={globalStyles.title}>INFO MODAL</Text>
      <Text style={[globalStyles.linkText, { marginBottom: 20 }]}>Esta é uma janela de sobreposição padrão.</Text>
      
      <TouchableOpacity style={globalStyles.buttonPrimary} onPress={() => router.back()}>
        <Text style={globalStyles.buttonText}>Fechar</Text>
      </TouchableOpacity>
    </View>
  );
}