import { db } from "../firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

export enum CommandType {
  LOCK_NOW = "LOCK_NOW",
  UNLOCK_NOW = "UNLOCK_NOW",
  START_TRACKING = "START_TRACKING",
  STOP_TRACKING = "STOP_TRACKING",
  REFRESH_LOCATION = "REFRESH_LOCATION",
  RING_PHONE = "RING_PHONE"
}

export class CommandRepository {
  static async sendCommand(childId: string, commandType: CommandType) {
    if (!db || !childId) return;

    const commandId = uuidv4();
    const commandRef = doc(db, "children", childId, "remoteCommands", commandId);

    const command = {
      commandId,
      childId,
      commandType,
      status: "PENDING",
      createdAt: Date.now()
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
