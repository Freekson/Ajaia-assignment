export type SaveQueueStatus = "saved" | "saving" | "error" | "conflict";
export type SaveFailureKind = "error" | "conflict";

export class SaveQueueFailure extends Error {
  constructor(
    public readonly kind: SaveFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "SaveQueueFailure";
  }
}

export class SerializedSaveQueue<Patch extends object> {
  private pending: Patch | null = null;
  private active: Promise<boolean> | null = null;
  private blocked: SaveFailureKind | null = null;

  constructor(
    private readonly sender: (patch: Patch) => Promise<void>,
    private readonly onStatus: (status: SaveQueueStatus, message?: string) => void,
  ) {}

  enqueue(patch: Patch) {
    this.pending = { ...(this.pending ?? {}), ...patch };
    if (!this.blocked) this.onStatus("saving");
  }

  hasUnsavedChanges() {
    return this.pending !== null || this.active !== null || this.blocked !== null;
  }

  flush(): Promise<boolean> {
    if (this.blocked) return Promise.resolve(false);
    if (this.active) return this.active;
    this.active = this.drain().finally(() => {
      this.active = null;
    });
    return this.active;
  }

  retry() {
    this.blocked = null;
    return this.flush();
  }

  discard() {
    this.pending = null;
    this.blocked = null;
    this.onStatus("saved");
  }

  private async drain() {
    while (this.pending) {
      const patch = this.pending;
      this.pending = null;
      this.onStatus("saving");
      try {
        await this.sender(patch);
      } catch (error) {
        this.pending = { ...patch, ...(this.pending ?? {}) };
        const failure =
          error instanceof SaveQueueFailure ? error : new SaveQueueFailure("error", "Save failed.");
        this.blocked = failure.kind;
        this.onStatus(failure.kind, failure.message);
        return false;
      }
    }
    this.onStatus("saved");
    return true;
  }
}
