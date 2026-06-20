import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export interface FamilyData {
  familyId: string;
  parentDeviceId: string;
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
}
