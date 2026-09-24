import { randomUUID } from "crypto";

export function id(): string {
  return randomUUID();
}
