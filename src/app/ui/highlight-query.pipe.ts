import {Pipe, PipeTransform} from '@angular/core';

/**
 * Wraps every case-insensitive occurrence of `query` in `text` with `<b>`,
 * HTML-escaping everything else. Bind the result via `[innerHTML]` — only the
 * `<b>` tags produced here survive escaping, so the output is safe to render.
 */
@Pipe({
  name: 'highlightQuery',
  standalone: true,
})
export class HighlightQueryPipe implements PipeTransform {
  transform(text: string, query: string): string {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return escapeHtml(text);
    }

    const haystack = text.toLowerCase();
    let result = '';
    let position = 0;
    for (let found = haystack.indexOf(needle); found !== -1; found = haystack.indexOf(needle, position)) {
      result += escapeHtml(text.slice(position, found));
      result += `<b>${escapeHtml(text.slice(found, found + needle.length))}</b>`;
      position = found + needle.length;
    }
    return result + escapeHtml(text.slice(position));
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
