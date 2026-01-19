import { describe, it, expect } from 'vitest';
import { urlPatternMatcher, PATTERN_TYPES } from '../utils/UrlPatternMatcher';

describe('UrlPatternMatcher', () => {
  describe('detectPatternType', () => {
    it('should detect simple wildcard pattern (no special syntax)', () => {
      expect(urlPatternMatcher.detectPatternType('*.example.com')).toBe(
        PATTERN_TYPES.SIMPLE_WILDCARD
      );
    });

    it('should detect segment extraction pattern', () => {
      expect(urlPatternMatcher.detectPatternType('{subdomain}.example.com')).toBe(
        PATTERN_TYPES.SEGMENT_EXTRACTION
      );
    });

    it('should detect regex pattern', () => {
      expect(urlPatternMatcher.detectPatternType('/example\\.com/')).toBe(PATTERN_TYPES.REGEX);
    });

    it('should default to simple wildcard for plain domain', () => {
      expect(urlPatternMatcher.detectPatternType('example.com')).toBe(PATTERN_TYPES.SIMPLE_WILDCARD);
    });
  });

  describe('match - simple wildcard', () => {
    it('should match exact domain', () => {
      const result = urlPatternMatcher.match('https://example.com', 'example.com');
      expect(result.matched).toBe(true);
    });

    it('should match domain with www', () => {
      const result = urlPatternMatcher.match('https://www.example.com', 'www.example.com');
      expect(result.matched).toBe(true);
    });

    it('should match wildcard subdomain', () => {
      const result = urlPatternMatcher.match('https://blog.example.com', '*.example.com');
      expect(result.matched).toBe(true);
    });

    it('should match wildcard subdomain with www', () => {
      const result = urlPatternMatcher.match('https://www.example.com', '*.example.com');
      expect(result.matched).toBe(true);
    });

    it('should not match different domain', () => {
      const result = urlPatternMatcher.match('https://different.com', 'example.com');
      expect(result.matched).toBe(false);
    });

    it('should return group name from options', () => {
      const result = urlPatternMatcher.match('https://example.com', 'example.com', {
        ruleName: 'My Rule',
      });
      expect(result.matched).toBe(true);
      expect(result.groupName).toBe('My Rule');
    });

    it('should handle URL with path', () => {
      const result = urlPatternMatcher.match('https://example.com/path/to/page', 'example.com');
      expect(result.matched).toBe(true);
    });

    it('should handle URL with query string', () => {
      const result = urlPatternMatcher.match('https://example.com?foo=bar', 'example.com');
      expect(result.matched).toBe(true);
    });

    it('should handle empty URL', () => {
      const result = urlPatternMatcher.match('', 'example.com');
      expect(result.matched).toBe(false);
    });

    it('should handle empty pattern', () => {
      const result = urlPatternMatcher.match('https://example.com', '');
      expect(result.matched).toBe(false);
    });

    it('should be case-insensitive', () => {
      const result = urlPatternMatcher.match('https://EXAMPLE.COM', 'example.com');
      expect(result.matched).toBe(true);
    });
  });

  describe('match - segment extraction', () => {
    it('should extract subdomain', () => {
      const result = urlPatternMatcher.match('https://blog.example.com', '{subdomain}.example.com');
      expect(result.matched).toBe(true);
      expect(result.extractedValues.subdomain).toBe('blog');
    });

    it('should extract and use in group name', () => {
      const result = urlPatternMatcher.match('https://blog.example.com', '{subdomain}.example.com', {
        ruleName: 'Example Sites',
      });
      expect(result.matched).toBe(true);
      expect(result.extractedValues.subdomain).toBe('blog');
    });

    it('should extract multiple segments', () => {
      const result = urlPatternMatcher.match(
        'https://user.blog.example.com',
        '{user}.{section}.example.com'
      );
      expect(result.matched).toBe(true);
      expect(result.extractedValues.user).toBe('user');
      expect(result.extractedValues.section).toBe('blog');
    });

    it('should not match if segments dont align', () => {
      const result = urlPatternMatcher.match('https://example.com', '{subdomain}.example.com');
      expect(result.matched).toBe(false);
    });
  });

  describe('match - regex patterns', () => {
    it('should match with regex pattern', () => {
      const result = urlPatternMatcher.match('https://example.com', '/example\\.com/');
      expect(result.matched).toBe(true);
    });

    it('should not match with non-matching regex', () => {
      const result = urlPatternMatcher.match('https://different.com', '/example\\.com/');
      expect(result.matched).toBe(false);
    });

    it('should handle regex with character class', () => {
      const result = urlPatternMatcher.match('https://test123.example.com', '/test[0-9]+\\.example\\.com/');
      expect(result.matched).toBe(true);
    });
  });

  describe('validatePattern', () => {
    it('should validate simple domain pattern', () => {
      const result = urlPatternMatcher.validatePattern('example.com');
      expect(result.isValid).toBe(true);
    });

    it('should validate wildcard pattern', () => {
      const result = urlPatternMatcher.validatePattern('*.example.com');
      expect(result.isValid).toBe(true);
    });

    it('should validate segment extraction pattern', () => {
      const result = urlPatternMatcher.validatePattern('{subdomain}.example.com');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty pattern', () => {
      const result = urlPatternMatcher.validatePattern('');
      expect(result.isValid).toBe(false);
    });

    it('should reject pattern with only whitespace', () => {
      const result = urlPatternMatcher.validatePattern('   ');
      expect(result.isValid).toBe(false);
    });
  });
});
