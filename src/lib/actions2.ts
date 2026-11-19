"use server";
// Extra server actions (kept separate to keep actions.ts manageable).
import { revalidatePath } from "next/cache";
import { deleteRule } from "./money";
export async function deleteRuleAction(id: number) { deleteRule(id); revalidatePath("/money", "layout"); }
