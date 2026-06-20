import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export interface DailySummary {
  id: string;
  date: number;
  childId: string;
  summaryText: string;
  safetyScore: number;
  generatedAt: number;
}

export class DailySummaryRepository {
  static listenToLatestSummary(childId: string, onUpdate: (summary: DailySummary | null) => void) {
    if (!db || !childId) return () => {};

    // Collection name from FIREBASE_STRUCTURE.md: dailySummaries/{childId}/{date}
    const summaryRef = collection(db, "children", childId, "dailySummaries");
    const q = query(summaryRef, orderBy("date", "desc"), limit(1));

    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        onUpdate(snapshot.docs[0].data() as DailySummary);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Error listening to daily summary:", error);
      onUpdate(null);
    });
  }
}
