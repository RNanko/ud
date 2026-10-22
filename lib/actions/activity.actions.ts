"use server";
import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { requireUserId } from "../session";
import { completeActivity, activityCompletionSchema } from "../events/activity-completion";
import { readActivityRecord } from "../events/activity-record";
import { afterNotificationSourceChange } from "../notifications/store";

export async function setActivityCompletion(input: unknown, expectedOwner: string) {
  return (await setPlannerActivityCompletion(input, expectedOwner)).occurrence;
}

export async function setPlannerActivityCompletion(input: unknown, expectedOwner: string) {
  const owner = await requireUserId(expectedOwner, "write");
  const command = activityCompletionSchema.parse(input);
  await completeActivity(owner, command);
  revalidateTag("events-data", { expire: 0 });
  after(() => afterNotificationSourceChange(owner));
  return readActivityRecord(owner, command.id, command.date);
}
