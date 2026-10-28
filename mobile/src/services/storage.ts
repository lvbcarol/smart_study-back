// Armazenamento local: SecureStore no celular (criptografado) e localStorage na web (só para testes no navegador).
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem(key, value); } catch { /* armazenamento indisponível */ }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { window.localStorage.removeItem(key); } catch { /* ignora */ }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
