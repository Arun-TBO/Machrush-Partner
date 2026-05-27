import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { auth } from './firebase';

/**
 * User Context - Manages authenticated user state globally
 * Provides Firebase user UID and phone number across the entire app
 */

export interface UserContextType {
  user: User | null;
  uid: string | null;
  phoneNumber: string | null;
  idToken: string | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setIdToken: (token: string) => void;
  logout: () => Promise<void>;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export interface UserProviderProps {
  children: ReactNode;
}

/**
 * UserProvider Component
 * Wraps the app and provides global user authentication state
 */
export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize user state on app mount
   * Check if user is already authenticated
   */
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(
      (currentUser) => {
        if (currentUser) {
          console.log('👤 User already authenticated:', currentUser.uid);
          setUser(currentUser);
          
          // Get ID token for API calls
          currentUser.getIdToken().then((token) => {
            setIdToken(token);
            console.log('🔐 ID Token refreshed');
          });
        } else {
          console.log('❌ No authenticated user');
          setUser(null);
          setIdToken(null);
        }
        
        setIsLoading(false);
      },
      (error) => {
        console.error('Auth state error:', error);
        setError(error.message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  /**
   * Logout the current user
   */
  const logout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setIdToken(null);
      console.log('✅ User logged out');
    } catch (error: any) {
      console.error('Error during logout:', error);
      setError(error.message);
    }
  };

  const value: UserContextType = {
    user,
    uid: user?.uid || null,
    phoneNumber: user?.phoneNumber || null,
    idToken,
    isLoading,
    error,
    setUser,
    setIdToken,
    logout,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

/**
 * Hook to use UserContext
 * @returns UserContextType
 */
export const useUser = (): UserContextType => {
  const context = React.useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
