import { auth } from "./firebase";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";

export const signIn = async (): Promise<User | null> => {
  if (!auth) return null;
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error("Anonymous sign-in failed:", error);
    return null;
  }
};

export const observeAuth = (onUpdate: (user: User | null) => void) => {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, onUpdate);
};
