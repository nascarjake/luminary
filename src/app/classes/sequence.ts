export class Sequence {

  private steps: Function[] = [];
  private completed: boolean = false;
  private aborted: boolean = false;
  private _onComplete?: () => void;
  private _onAbort?: () => void;

  constructor(...steps: (() => Promise<any>|any)[]) {
    this.steps = steps;
  }

  public async run(): Promise<void> {
    for (const step of this.steps) {
      if (this.aborted) return;
      await step();
    }
    this.completed = true;
    this._onComplete && this._onComplete();
  }

  public abort(): void {
    this.aborted = true;
    this._onAbort && this._onAbort();
  }

  public isCompleted(): boolean {
    return this.completed;
  }

  public isAborted(): boolean {
    return this.aborted;
  }

  public onComplete(callback: () => void): void {
    this._onComplete = callback;
  }

  public onAbort(callback: () => void): void {
    this._onAbort = callback;
  }

}
