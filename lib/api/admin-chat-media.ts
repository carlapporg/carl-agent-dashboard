export const ADMIN_CHAT_MEDIA = {
  maxImageBytes: 10 * 1024 * 1024,
  maxFileBytes: 15 * 1024 * 1024,
} as const;

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif)$/i;
const FILE_EXT = /\.(pdf|docx?|xlsx?|txt|jpe?g|png|gif|webp|heic|heif)$/i;

export function isAdminChatImage(file: File): boolean {
  if (/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

export function isAdminChatFile(file: File): boolean {
  if (isAdminChatImage(file)) return true;
  if (
    /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/plain)$/i.test(
      file.type,
    )
  ) {
    return true;
  }
  return FILE_EXT.test(file.name);
}

/** Same-origin URL. The server adds the agent bearer token and streams the file. */
export function adminChatFileSrc(conversationId: string, messageId: string): string {
  return `/api/agent/admin-chats/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/file`;
}

export function adminChatImageUploadUrl(conversationId: string): string {
  return `/api/agent/admin-chats/${encodeURIComponent(conversationId)}/messages/image`;
}

export function adminChatFileUploadUrl(conversationId: string): string {
  return `/api/agent/admin-chats/${encodeURIComponent(conversationId)}/messages/file`;
}
