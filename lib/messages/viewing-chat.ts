/** Which task chat is open on the Messages screen (not task detail). */
let viewingMessagesTaskId: string | null = null;

export function setViewingMessagesTaskId(taskId: string | null) {
  viewingMessagesTaskId = taskId;
}

export function getViewingMessagesTaskId(): string | null {
  return viewingMessagesTaskId;
}
