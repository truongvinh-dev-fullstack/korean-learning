import { z } from "zod";

/** Audio uses repository-local paths or direct HTTP(S) URLs, never executable schemes. */
export const AudioUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    if (value.startsWith("/")) {
      return (
        /^\/[a-zA-Z0-9_\-./]+$/.test(value) &&
        !value.startsWith("//") &&
        !value.split("/").includes("..")
      );
    }
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Đường dẫn âm thanh phải là đường dẫn nội bộ hoặc URL HTTP(S) hợp lệ.");
