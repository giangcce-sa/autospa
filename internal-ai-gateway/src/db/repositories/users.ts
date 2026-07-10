import { nanoid } from "nanoid";
import { getDb } from "../client.js";
import type { ClientRecord, ClientType, EntityStatus, UserRecord, UserRole } from "./types.js";

function now(): string {
  return new Date().toISOString();
}

export function listUsers(): UserRecord[] {
  return getDb().prepare("SELECT * FROM users ORDER BY created_at DESC").all() as UserRecord[];
}

export function createUser(input: { email: string; name: string; role: UserRole }): UserRecord {
  const user: UserRecord = {
    id: `usr_${nanoid(10)}`,
    email: input.email,
    name: input.name,
    role: input.role,
    status: "active",
    created_at: now(),
    updated_at: now()
  };

  getDb()
    .prepare("INSERT INTO users (id, email, name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(user.id, user.email, user.name, user.role, user.status, user.created_at, user.updated_at);

  return user;
}

export function updateUserStatus(id: string, status: EntityStatus): UserRecord | undefined {
  getDb().prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRecord | undefined;
}

export function listClients(): ClientRecord[] {
  return getDb().prepare("SELECT * FROM clients ORDER BY created_at DESC").all() as ClientRecord[];
}

export function createClient(input: { name: string; type: ClientType; ownerUserId: string }): ClientRecord {
  const client: ClientRecord = {
    id: `cli_${nanoid(10)}`,
    name: input.name,
    type: input.type,
    owner_user_id: input.ownerUserId,
    status: "active",
    created_at: now(),
    updated_at: now()
  };

  getDb()
    .prepare("INSERT INTO clients (id, name, type, owner_user_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(client.id, client.name, client.type, client.owner_user_id, client.status, client.created_at, client.updated_at);

  return client;
}

export function updateClientStatus(id: string, status: EntityStatus): ClientRecord | undefined {
  getDb().prepare("UPDATE clients SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
  return getDb().prepare("SELECT * FROM clients WHERE id = ?").get(id) as ClientRecord | undefined;
}
