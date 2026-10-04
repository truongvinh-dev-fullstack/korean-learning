export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { readAiProviderConfig } = await import("./modules/ai-lessons/ai-provider.config");
    readAiProviderConfig(); // Fail before this server instance accepts requests.
  }
}
