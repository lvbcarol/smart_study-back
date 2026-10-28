import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/ui';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Redirect href={user ? '/home' : '/login'} />;
}
