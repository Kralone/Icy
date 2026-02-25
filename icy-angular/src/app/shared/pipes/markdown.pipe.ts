import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    if (/<[a-z][\s\S]*>/i.test(value)) {
      return value;
    }

    return marked.parse(value, { breaks: true }) as string;
  }
}
