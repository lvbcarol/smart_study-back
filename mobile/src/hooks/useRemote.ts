import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** Carrega dados da API sempre que a tela ganha foco (ex.: voltar de um quiz atualiza as listas). */
export function useRemote<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await loader());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = useCallback(() => { setRefreshing(true); load(); }, [load]);
  return { data, error, refreshing, refresh, reload: load, setData };
}
