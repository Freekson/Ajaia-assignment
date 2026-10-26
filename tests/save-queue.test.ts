import { describe, expect, it, vi } from "vitest";
import { SaveQueueFailure, SerializedSaveQueue } from "@/lib/save-queue";

describe("serialized save queue", () => {
  it("serializes writes and sends the newest pending content last", async () => {
    let releaseFirst!: () => void;
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const sent: string[] = [];
    const sender = vi.fn(async (patch: { content: string }) => {
      sent.push(patch.content);
      if (patch.content === "first") await firstRequest;
    });
    const queue = new SerializedSaveQueue(sender, vi.fn());
    queue.enqueue({ content: "first" });
    const flushing = queue.flush();
    queue.enqueue({ content: "latest" });
    releaseFirst();
    await flushing;
    expect(sent).toEqual(["first", "latest"]);
  });

  it("retains unsaved content after failure and sends it on retry", async () => {
    const sender = vi
      .fn()
      .mockRejectedValueOnce(new SaveQueueFailure("error", "Offline"))
      .mockResolvedValueOnce(undefined);
    const queue = new SerializedSaveQueue<{ content: string }>(sender, vi.fn());
    queue.enqueue({ content: "keep me" });
    expect(await queue.flush()).toBe(false);
    expect(queue.hasUnsavedChanges()).toBe(true);
    expect(await queue.retry()).toBe(true);
    expect(sender).toHaveBeenLastCalledWith({ content: "keep me" });
    expect(queue.hasUnsavedChanges()).toBe(false);
  });
});
