import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  arrayUnion
} from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface SupportTicket {
  ticketId: string;
  familyId: string;
  parentUid: string;
  parentEmail: string;
  subject: string;
  message: string;
  category: string;
  status: TicketStatus;
  createdAt: any;
  updatedAt: any;
  assignedTo?: string;
  replies: TicketReply[];
}

export interface TicketReply {
  replyId: string;
  authorUid: string;
  authorEmail: string;
  authorRole: 'PARENT' | 'ADMIN' | 'SUPPORT';
  message: string;
  createdAt: any;
}

export class SupportRepository {
  static async createTicket(ticket: Omit<SupportTicket, 'ticketId' | 'status' | 'createdAt' | 'updatedAt' | 'replies'>): Promise<string> {
    if (!db) throw new Error("Firestore not initialized");
    const ticketId = uuidv4().substring(0, 8).toUpperCase();
    const ref = doc(db, "supportTickets", ticketId);

    const newTicket: SupportTicket = {
      ...ticket,
      ticketId,
      status: 'OPEN',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      replies: []
    };

    await setDoc(ref, newTicket);
    return ticketId;
  }

  static listenToParentTickets(parentUid: string, onUpdate: (tickets: SupportTicket[]) => void) {
    if (!db) return () => {};
    const q = query(
      collection(db, "supportTickets"),
      where("parentUid", "==", parentUid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(doc => doc.data() as SupportTicket));
    });
  }

  static listenToAllTickets(onUpdate: (tickets: SupportTicket[]) => void) {
    if (!db) return () => {};
    const q = query(
      collection(db, "supportTickets"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(doc => doc.data() as SupportTicket));
    });
  }

  static listenToTicket(ticketId: string, onUpdate: (ticket: SupportTicket | null) => void) {
    if (!db || !ticketId) return () => {};
    const ref = doc(db, "supportTickets", ticketId);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as SupportTicket);
      } else {
        onUpdate(null);
      }
    });
  }

  static async replyToTicket(ticketId: string, reply: Omit<TicketReply, 'replyId' | 'createdAt'>): Promise<void> {
    if (!db) return;
    const ref = doc(db, "supportTickets", ticketId);
    const replyData: TicketReply = {
      ...reply,
      replyId: uuidv4(),
      createdAt: new Date() // Using JS date for immediate local update if needed, Firestore will handle it
    };

    await updateDoc(ref, {
      replies: arrayUnion(replyData),
      updatedAt: serverTimestamp(),
      status: reply.authorRole !== 'PARENT' ? 'IN_PROGRESS' : 'OPEN'
    });
  }

  static async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
      if (!db) return;
      const ref = doc(db, "supportTickets", ticketId);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() });
  }
}
