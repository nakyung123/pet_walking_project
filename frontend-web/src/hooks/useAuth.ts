'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User, AuthError } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async (): Promise<{ popupBlocked?: boolean }> => {
    try {
      await signInWithPopup(auth, googleProvider);
      return {};
    } catch (e) {
      const code = (e as AuthError).code;
      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        return { popupBlocked: true };
      }
      throw e;
    }
  };

  const logout = () => signOut(auth);

  return { user, loading, signInWithGoogle, logout };
}
