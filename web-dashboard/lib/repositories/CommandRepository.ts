import { db } from "../firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

export enum CommandType {
  REFRESH_LOCATION = "REFRESH_LOCATION",
  RING_DEVICE = "RING_DEVICE",
  LOCK_DEVICE = "LOCK_DEVICE",
  UNLOCK_DEVICE = "UNLOCK_DEVICE",
  SHOW_MESSAGE = "SHOW_MESSAGE",
  VIBRATE_DEVICE = "VIBRATE_DEVICE",
  // Legacy
  LOCK_NOW = "LOCK_NOW",
  UNLOCK_NOW = "UNLOCK_NOW",
  START_TRACKING = "START_TRACKING",
  STOP_TRACKING = "STOP_TRACKING",
  RING_PHONE = "RING_PHONE",
  SOUND_SIREN = "SOUND_SIREN"
}

export class CommandRepository {
  static async sendCommand(childId: string, commandType: CommandType, payload: string | null = null) {
    if (!db || !childId) return;

    const commandId = uuidv4();
    const commandRef = doc(db, "children", childId, "remoteCommands", commandId);
    const parentId = localStorage.getItem("kidsguard_parent_id") || "unknown";

    const expiryMap: Record<string, number> = {
        [CommandType.REFRESH_LOCATION]: 2 * 60 * 1000,
        [CommandType.RING_DEVICE]: 2 * 60 * 1000,
        [CommandType.LOCK_DEVICE]: 5 * 60 * 1000,
        [CommandType.UNLOCK_DEVICE]: 5 * 60 * 1000,
        [CommandType.SHOW_MESSAGE]: 10 * 60 * 1000,
        [CommandType.VIBRATE_DEVICE]: 2 * 60 * 1000
    };

    const command = {
      commandId,
      childId,
      commandType,
      payload,
      status: "PENDING",
      createdByParentId: parentId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (expiryMap[commandType] || 5 * 60 * 1000)
    };

    try {
      await setDoc(commandRef, command);
      console.log(`Command ${commandType} sent to ${childId}`);
    } catch (error) {
      console.error("Error sending remote command:", error);
      throw error;
    }
  }
}
