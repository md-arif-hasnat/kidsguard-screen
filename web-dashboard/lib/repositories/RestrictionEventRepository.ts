import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp
} from "firebase/firestore";
import { db } from "../firebase";

export type RestrictionReason =
  | "STATIC_BLOCK"
  | "LIMIT_REACHED"
  | "TOTAL_LIMIT_REACHED"
  | "SCHEDULE"
  | string;

export interface RestrictionEvent {
  id: string;
  eventId: string;
  childId: string;
  childName?: string;
  packageName: string;
  appName: string;
  reason: RestrictionReason;
  occurredAt: number;
  date: string;
}

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return typeof value === "number" ? value : 0;
}

export class RestrictionEventRepository {
  static subscribe(
    childId: string,
    callback: (events: RestrictionEvent[]) => void,
    onError?: (error: Error) => void
  ) {
    if (!db || !childId) {
      callback([]);
      return () => {};
    }

    const eventsQuery = query(
      collection(db, "children", childId, "appRestrictionEvents"),
      orderBy("occurredAt", "desc"),
      limit(100)
    );

    return onSnapshot(
      eventsQuery,
      snapshot => {
        callback(snapshot.docs.map(document => {
          const data = document.data();
          return {
            id: document.id,
            eventId: String(data.eventId || document.id),
            childId: String(data.childId || childId),
            childName: data.childName ? String(data.childName) : undefined,
            packageName: String(data.packageName || ""),
            appName: String(data.appName || "Unknown app"),
            reason: String(data.reason || "STATIC_BLOCK"),
            occurredAt: toMillis(data.occurredAt),
            date: String(data.date || "")
          };
        }));
      },
      error => {
        console.error("RESTRICTION_HISTORY_LOAD_FAILED", error);
        callback([]);
        onError?.(error);
      }
    );
  }
}
