"use client";

import { FirebaseStorage, getStorage } from 'firebase/storage';
import { app } from './firebase';

export const getFirebaseStorage = (): FirebaseStorage | undefined => {
  if (!app || typeof window === 'undefined') return undefined;
  return getStorage(app);
};
