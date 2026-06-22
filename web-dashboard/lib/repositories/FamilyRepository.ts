import { db } from "../firebase";
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

export interface FamilyData {
  familyId: string;
  parentIds: string[];
  childDeviceIds: string[];
  createdAt: any;
}

export class FamilyRepository {
  static listenToFamily(familyId: string, onUpdate: (data: FamilyData | null) => void) {
    if (!db || !familyId) return () => {};

    const familyRef = doc(db, "families", familyId);
    return onSnapshot(familyRef, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as FamilyData);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Error listening to family:", error);
      onUpdate(null);
    });
  }

  static async createFamily(parentId: string): Promise<string> {
    if (!db) throw new Error("Firestore not initialized");
    const familyId = uuidv4();
    const family: FamilyData = {
      familyId,
      parentIds: [parentId],
      childDeviceIds: [],
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "families", familyId), family);
    return familyId;
  }

  static async pairChild(familyId: string, pairingCode: string): Promise<boolean> {
    if (!db) return false;

    console.log(`WEB: Searching for pair code: ${pairingCode}`);
    const codePath = `pairingCodes/${pairingCode}`;
    console.log(`WEB: Target Firestore path: ${codePath}`);

    // 1. Find pairing code in pairingCodes collection (Document ID is the code)
    const codeRef = doc(db, "pairingCodes", pairingCode);
    const snap = await getDoc(codeRef);

    if (!snap.exists()) {
      console.warn(`WEB: Pair code ${pairingCode} NOT FOUND at ${codePath}`);
      return false;
    }

    const pairingData = snap.data();
    console.log(`WEB: Document found:`, pairingData);

    // Check used status
    if (pairingData.used) {
        console.warn(`WEB: Pair code ${pairingCode} has already been used.`);
        return false;
    }

    // Check expiry
    const expiresAt = pairingData.expiresAt?.toMillis() || 0;
    if (Date.now() > expiresAt) {
      console.warn(`WEB: Pair code ${pairingCode} has expired.`);
      return false;
    }

    const deviceId = pairingData.deviceId || pairingData.childDeviceId;
    const childId = pairingData.childId || deviceId;

    if (!deviceId || !childId) {
        console.error(`WEB: Missing ID in pairing document.`);
        return false;
    }

    console.log(`WEB: Linking child ${childId} (device: ${deviceId}) to family ${familyId}`);

    // 2. Add childId to family
    const familyRef = doc(db, "families", familyId);
    await updateDoc(familyRef, {
      childDeviceIds: arrayUnion(childId)
    });

    // 3. Create/Update child record
    const childRef = doc(db, "children", childId);
    await setDoc(childRef, {
        childId,
        deviceId,
        name: pairingData.childName || "Unnamed Child",
        familyId: familyId,
        pairedAt: serverTimestamp(),
        lastSeen: serverTimestamp()
    }, { merge: true });

    // 4. Mark code as used
    await updateDoc(codeRef, {
        used: true
    });

    console.log(`WEB: Pairing successful for child ${childId}`);
    return true;
  }
}
