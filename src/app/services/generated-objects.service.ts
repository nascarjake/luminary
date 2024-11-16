import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ScriptOutline {
  title?: string;
  [key: string]: any;
}

export interface Script {
  content: string;
  title?: string;
  threadId: string;
}

export interface PictoryRequest {
  content: any;
  title?: string;
  threadId: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeneratedObjectsService {
  private outlines$ = new BehaviorSubject<ScriptOutline[]>([]);
  private scripts$ = new BehaviorSubject<Script[]>([]);
  private pictoryRequests$ = new BehaviorSubject<PictoryRequest[]>([]);

  // Observable streams
  readonly outlines = this.outlines$.asObservable();
  readonly scripts = this.scripts$.asObservable();
  readonly pictoryRequests = this.pictoryRequests$.asObservable();

  constructor() {}

  // Add methods
  addOutline(outline: ScriptOutline) {
    const current = this.outlines$.getValue();
    this.outlines$.next([...current, outline]);
  }

  addScript(script: Script) {
    const current = this.scripts$.getValue();
    this.scripts$.next([...current, script]);
  }

  addPictoryRequest(request: PictoryRequest) {
    const current = this.pictoryRequests$.getValue();
    this.pictoryRequests$.next([...current, request]);
  }

  // Clear individual arrays
  clearOutlines() {
    this.outlines$.next([]);
  }

  clearScripts() {
    this.scripts$.next([]);
  }

  clearPictoryRequests() {
    this.pictoryRequests$.next([]);
  }

  // Clear all arrays
  clearAll() {
    this.clearOutlines();
    this.clearScripts();
    this.clearPictoryRequests();
  }

  // Get current values
  getCurrentOutlines(): ScriptOutline[] {
    return this.outlines$.getValue();
  }

  getCurrentScripts(): Script[] {
    return this.scripts$.getValue();
  }

  getCurrentPictoryRequests(): PictoryRequest[] {
    return this.pictoryRequests$.getValue();
  }
}
