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
  where
} from "firebase/firestore";

export interface BrowserHistoryItem {
  id: string;
  historyId: string;
  url: string | null;
  domain: string | null;
  pageTitle: string | null;
  browserPackage: string;
  capturedAt: number;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number;
  deviceId: string | null;
  uploadedAt: number | null;
  syncVersion: number;
  createdBy: string | null;
}

export class BrowserHistoryRepository {
  static async getBrowserHistoryPage(
    familyId: string,
    childId: string,
    lastDoc?: QueryDocumentSnapshot<DocumentData>,
    pageSize: number = 20
  ) {
    if (!db || !familyId || !childId) return { data: [], lastDoc: null };

    const historyRef = collection(db, "families", familyId, "children", childId, "browserHistory");
    let q = query(historyRef, orderBy("capturedAt", "desc"), limit(pageSize));

    if (lastDoc) {
      q = query(historyRef, orderBy("capturedAt", "desc"), startAfter(lastDoc), limit(pageSize));
    }

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BrowserHistoryItem));

    return {
      data,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
    };
  }

  static filterHistory(
    history: BrowserHistoryItem[],
    searchQuery: string,
    browserFilter: string,
    dateFilter: 'all' | 'today' | '7d' | '30d'
  ): BrowserHistoryItem[] {
    let filtered = [...history];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        (item.pageTitle && item.pageTitle.toLowerCase().includes(q)) ||
        (item.url && item.url.toLowerCase().includes(q)) ||
        (item.domain && item.domain.toLowerCase().includes(q))
      );
    }

    // Browser filter
    if (browserFilter !== 'all') {
      filtered = filtered.filter(item => item.browserPackage.includes(browserFilter.toLowerCase()));
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
