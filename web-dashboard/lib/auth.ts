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
  sendEmailVerification,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail
} from "firebase/auth";

const authError = (code: string, message: string): Error & { code: string } =>
  Object.assign(new Error(message), { code });

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
    await sendEmailVerification(
      result.user,
      {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false
      }
    );
    return result.user;
  } catch (error) {
    console.error("Signup failed:", error);
    throw error;
  }
};

export const sendVerificationEmail = async (user: User) => {
  await sendEmailVerification(user, {
    url: `${window.location.origin}/login`,
    handleCodeInApp: false
  });
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

export const resetPassword = async (email: string) => {
  if (!auth) return;
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Password reset failed:", error);
    throw error;
  }
};

export const reauthenticateOwnerForEmailChange = async (
  currentPassword: string
): Promise<User> => {
  const user = auth?.currentUser;
  const currentEmail = user?.email?.trim().toLowerCase();

  if (!user || !currentEmail) {
    throw authError(
      "auth/user-not-found",
      "Your authenticated account is unavailable. Please sign in again."
    );
  }

  const hasPasswordProvider = user.providerData.some(
    (provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID
  );
  if (!hasPasswordProvider) {
    throw authError(
      "auth/password-provider-required",
      "This account does not use a password. Email changes must be completed through its sign-in provider."
    );
  }

  if (!currentPassword) {
    throw authError(
      "auth/missing-password",
      "Enter your current password to continue."
    );
  }

  const credential = EmailAuthProvider.credential(
    currentEmail,
    currentPassword
  );
  await reauthenticateWithCredential(user, credential);

  return user;
};

export const sendOwnerEmailChangeVerification = async (
  user: User,
  newEmail: string
): Promise<string> => {
  const currentEmail = user.email?.trim().toLowerCase();
  const normalizedEmail = newEmail.trim().toLowerCase();

  if (!currentEmail) {
    throw authError(
      "auth/user-not-found",
      "Your authenticated account is unavailable. Please sign in again."
    );
  }

  if (!normalizedEmail) {
    throw authError("auth/invalid-email", "Enter a valid new email address.");
  }

  if (normalizedEmail === currentEmail) {
    throw authError(
      "auth/same-email",
      "The new email address must be different from your current email."
    );
  }

  await verifyBeforeUpdateEmail(user, normalizedEmail, {
    url: `${window.location.origin}/login?emailChange=verified`,
    handleCodeInApp: false
  });

  return normalizedEmail;
};

export const requestOwnerEmailChange = async (
  newEmail: string,
  currentPassword: string
): Promise<string> => {
  const user = await reauthenticateOwnerForEmailChange(currentPassword);
  return sendOwnerEmailChangeVerification(user, newEmail);
};
