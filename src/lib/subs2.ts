import { db } from "./db";
export const deleteSubRow = (id: number) => db.prepare("DELETE FROM subscriptions WHERE id=?").run(id).changes > 0;
