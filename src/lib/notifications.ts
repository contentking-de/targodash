import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "task_assigned"
  | "task_comment"
  | "task_mention"
  | "ticket_assigned"
  | "ticket_update"
  | "ticket_mention"
  | "briefing_new"
  | "briefing_completed"
  | "editorial_plan"
  | "content_review"
  | "revision_request"
  | "recheck_ready"
  | "new_content";

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function createNotificationsForUsers({
  userIds,
  type,
  title,
  message,
  link,
}: {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  if (userIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, type, title, message, link })),
    });
  } catch (error) {
    console.error("Failed to create notifications:", error);
  }
}
