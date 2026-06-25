import { auth } from "./firebase";
import {
  signInAnonymously,
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  sendEmailVerification
} from "firebase/auth";

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

export const loginWithEmail = async (email: string, password: string): Promise<User | null> => {
  if (!auth) return null;
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, password: string): Promise<User | null> => {
  if (!auth) return null;
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(result.user);
    return result.user;
  } catch (error) {
    console.error("Signup failed:", error);
    throw error;
  }
};

export const loginWithGoogle = async (): Promise<User | null> => {
  if (!auth) return null;
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Google sign-in failed:", error);
    throw error;
  }
};

export const loginWithApple = async (): Promise<User | null> => {
  if (!auth) return null;
  try {
    const provider = new OAuthProvider("apple.com");
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/operation-not-allowed') {
      throw new Error("Apple login requires Apple Developer configuration in Firebase Console.");
    }
    console.error("Apple sign-in failed:", error);
    throw error;
  }
};

export const setupRecaptcha = (containerId: string) => {
  if (!auth) return null;
  return new RecaptchaVerifier(auth, containerId, {
    'size': 'invisible',
  });
};

export const loginWithPhone = async (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult | null> => {
  if (!auth) return null;
  try {
    return await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  } catch (error) {
    console.error("Phone sign-in failed:", error);
    throw error;
  }
};

export const signOut = async () => {
  if (!auth) return;
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Sign out failed:", error);
  }
};

export const observeAuth = (onUpdate: (user: User | null) => void) => {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, onUpdate);
};
