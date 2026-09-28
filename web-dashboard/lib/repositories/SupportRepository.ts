"use client";

import { auth, db } from "../firebase";
import { getFirebaseStorage } from "../firebaseStorage";
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
import {
  getBlob,
  getMetadata,
  listAll,
  ref,
  uploadBytes
} from "firebase/storage";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

export interface SupportAttachment {
  name: string;
  contentType: string;
  size: number;
  objectUrl: string;
}

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
  lastAdminAction?: {
    type: 'REPLY' | 'STATUS_CHANGE';
    actorUid: string;
    actorEmail: string | null;
    status?: TicketStatus;
    occurredAt: Date;
  };
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
  static validateAttachment(file: File): void {
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
      throw new Error('Only JPG, PNG, WebP, or PDF files are allowed.');
    }

    if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error('Attachment must be smaller than 5 MB.');
    }
  }

  static async uploadAttachment(
    parentUid: string,
    ticketId: string,
    file: File
  ): Promise<void> {
    const storage = getFirebaseStorage();
    if (!storage) throw new Error('Firebase Storage is not initialized');
    this.validateAttachment(file);

    const extension = file.name.includes('.')
      ? file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
      : '';
    const objectName = `${Date.now()}_${uuidv4()}${extension ? `.${extension}` : ''}`;
    const attachmentRef = ref(
      storage,
      `supportTickets/${parentUid}/${ticketId}/${objectName}`
    );

    await uploadBytes(attachmentRef, file, {
      contentType: file.type,
      customMetadata: {
        originalName: file.name.slice(0, 120),
        uploadedBy: parentUid
      }
    });
  }

  static async listTicketAttachments(
    parentUid: string,
    ticketId: string
  ): Promise<SupportAttachment[]> {
    const storage = getFirebaseStorage();
    if (!storage) return [];

    const folder = ref(
      storage,
      `supportTickets/${parentUid}/${ticketId}`
    );
    const result = await listAll(folder);

    return Promise.all(result.items.map(async item => {
      const [metadata, blob] = await Promise.all([
        getMetadata(item),
        getBlob(item)
      ]);

      return {
        name: metadata.customMetadata?.originalName || item.name,
        contentType: metadata.contentType || 'application/octet-stream',
        size: metadata.size,
        objectUrl: URL.createObjectURL(blob)
      };
    }));
  }

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
    }, (error) => {
      console.error("Error listening to parent tickets:", error);
      onUpdate([]);
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
    }, (error) => {
      console.error("Error listening to all tickets:", error);
      onUpdate([]);
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

    const update: Record<string, unknown> = {
      replies: arrayUnion(replyData),
      updatedAt: serverTimestamp(),
      status: reply.authorRole !== 'PARENT' ? 'IN_PROGRESS' : 'OPEN'
    };

    if (reply.authorRole !== 'PARENT') {
      update.lastAdminAction = {
        type: 'REPLY',
        actorUid: reply.authorUid,
        actorEmail: reply.authorEmail || null,
        occurredAt: new Date()
      };
    }

    await updateDoc(ref, update);
  }

  static async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
      if (!db) return;
      const user = auth?.currentUser;
      if (!user) throw new Error("Admin session is required.");
      const ref = doc(db, "supportTickets", ticketId);
      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
        lastAdminAction: {
          type: 'STATUS_CHANGE',
          actorUid: user.uid,
          actorEmail: user.email,
          status,
          occurredAt: new Date()
        }
      });
  }
}
