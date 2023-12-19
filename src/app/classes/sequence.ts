export class Sequence {

  private steps: Function[] = [];
  private completed: boolean = false;
  private aborted: boolean = false;
  private failed: boolean = false;
  private _onComplete?: () => void;
  private _onAbort?: () => void;
  private _onFail?: (err: any) => void;

  constructor(...steps: (() => Promise<any>|any)[]) {
    this.steps = steps;
  }

  public async run(): Promise<void> {
    for (const step of this.steps) {
      if (this.aborted) return;
      try {
        await step();
      } catch (err) {
        this.failed = true;
        this._onFail && this._onFail(err);
        return;
      }
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

  public hasFailed(): boolean {
    return this.failed;
  }

  public onFail(callback: (err: any) => void): void {
    this._onFail = callback;
  }

  public onComplete(callback: () => void): void {
    this._onComplete = callback;
  }

  public onAbort(callback: () => void): void {
    this._onAbort = callback;
  }

}
