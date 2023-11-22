import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';

@Pipe({
  name: 'mark',
  standalone: true
})
export class MarkPipe implements PipeTransform {

  constructor(
    private readonly domSanitizer: DomSanitizer
  ) { }

  transform(value: string): SafeHtml {
    const element = document.createElement('div');
    element.innerHTML = marked(value);
    const codeBlocks = Array.from(element.querySelectorAll('pre code')) as HTMLElement[];
    for (const codeBlock of codeBlocks) {
      hljs.highlightElement(codeBlock);
    }
    return this.domSanitizer.bypassSecurityTrustHtml(element.innerHTML);
  }

}
