import { describe, it, expect } from 'vitest';
import { resolveMaterialDisplay } from './resolveMaterialDisplay';

describe('resolveMaterialDisplay', () => {
  it('returns YouTube display for youtube kind', () => {
    const result = resolveMaterialDisplay('youtube', true);
    expect(result).toEqual({
      icon: 'YT',
      iconClass: 'yt',
      meta: 'YOUTUBE',
      label: 'YouTube',
    });
  });

  it('returns Article display for article kind', () => {
    const result = resolveMaterialDisplay('article', true);
    expect(result).toEqual({
      icon: 'BK',
      iconClass: 'bk',
      meta: 'ARTICLE',
      label: 'Article',
    });
  });

  it('returns Manual linked display for manual kind with URL', () => {
    const result = resolveMaterialDisplay('manual', true);
    expect(result.meta).toBe('MANUAL · LINKED');
    expect(result.icon).toBe('NB');
    expect(result.iconClass).toBe('notes');
    expect(result.label).toBe('Manual');
  });

  it('returns Manual no-embed display for manual kind without URL', () => {
    const result = resolveMaterialDisplay('manual', false);
    expect(result.meta).toBe('MANUAL · NO EMBED');
  });

  it('defaults to manual for undefined kind', () => {
    const result = resolveMaterialDisplay(undefined, false);
    expect(result.icon).toBe('NB');
    expect(result.meta).toBe('MANUAL · NO EMBED');
    expect(result.label).toBe('Manual');
  });

  it('ignores hasUrl for YouTube kind', () => {
    const withUrl = resolveMaterialDisplay('youtube', true);
    const withoutUrl = resolveMaterialDisplay('youtube', false);
    expect(withUrl).toEqual(withoutUrl);
  });
});
