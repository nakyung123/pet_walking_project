'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/map' : '/login');
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-yellow-400 border-t-transparent" />
    </div>
  );
}
