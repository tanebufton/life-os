import { PageHead } from "@/components/tasks";
import { TagManager } from "@/components/tagmanager";
import { allTags } from "@/lib/tags";

export const dynamic = "force-dynamic";
export default function Tags() { return <div className="max-w-4xl"><PageHead title="Tags" sub="Rename, merge, recolour or remove tags used on tasks, notes, goals and people" /><TagManager tags={allTags()} /></div>; }
