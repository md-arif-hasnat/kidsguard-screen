import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  where,
  Timestamp
} from "firebase/firestore";

export interface YouTubeActivity {
  id: string;
  historyId: string;
  videoTitle: string;
  channelName?: string | null;
  videoId?: string | null;
  youtubeUrl?: string | null;
  thumbnailUrl?: string | null;
  linkSource?: string | null;
  linkConfidence?: number | null;
  packageName?: string;
  capturedAt: number;
  startedAt: number;
  endedAt?: number | null;
  watchDurationSeconds?: number;
  deviceId?: string;
  uploadedAt?: number;
  syncVersion?: number;
  createdBy?: string;
}

export class YouTubeHistoryRepository {
  static listenToYouTubeHistory(
    familyId: string,
    childId: string,
    onUpdate: (history: YouTubeActivity[]) => void,
    pageSize: number = 20
  ) {
    if (!db || !familyId || !childId) return () => {};

    const historyRef = collection(db, "families", familyId, "children", childId, "youtubeHistory");
    const q = query(historyRef, orderBy("capturedAt", "desc"), limit(pageSize));

    return onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as YouTubeActivity));
      onUpdate(history);
    }, (error) => {
      console.error("Error listening to YouTube history:", error);
      onUpdate([]);
    });
  }

  static async getYouTubeHistoryPage(
    familyId: string,
    childId: string,
    lastDoc?: QueryDocumentSnapshot<DocumentData>,
    pageSize: number = 20
  ) {
    if (!db || !familyId || !childId) return { data: [], lastDoc: null };

    const historyRef = collection(db, "families", familyId, "children", childId, "youtubeHistory");
    let q = query(historyRef, orderBy("capturedAt", "desc"), limit(pageSize));

    if (lastDoc) {
      q = query(historyRef, orderBy("capturedAt", "desc"), startAfter(lastDoc), limit(pageSize));
    }

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as YouTubeActivity));

    return {
      data,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
    };
  }

  /**
   * Client-side filtering helper for a loaded list.
   */
  static filterHistory(
    history: YouTubeActivity[],
    searchQuery: string,
    dateFilter: 'all' | 'today' | '7d' | '30d'
  ): YouTubeActivity[] {
    let filtered = [...history];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.videoTitle.toLowerCase().includes(q) ||
        (item.channelName && item.channelName.toLowerCase().includes(q))
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      let cutoff = 0;
      if (dateFilter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        cutoff = today.getTime();
      } else if (dateFilter === '7d') {
        cutoff = now - (7 * oneDay);
      } else if (dateFilter === '30d') {
        cutoff = now - (30 * oneDay);
      }

      filtered = filtered.filter(item => item.capturedAt >= cutoff);
    }

    return filtered;
  }
}
