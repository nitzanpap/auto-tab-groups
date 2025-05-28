/**
 * Utility functions for domain handling
 */

/**
 * Extracts the domain from a URL based on configuration
 * @param {string} url - The URL to extract domain from
 * @param {boolean} includeSubDomains - Whether to include subdomains
 * @returns {string} The extracted domain
 */
export function extractDomain(url, includeSubDomains = false) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');

    if (includeSubDomains) {
      return hostname;
    }

    let domain = hostname;

    if (parts.length >= 2) {
      // Get the base domain (last two parts)
      domain = parts.slice(-2).join('.');

      // Special case for country-specific TLDs like .co.uk, .com.au
      const secondLevelDomains = [
        'co',
        'com',
        'org',
        'net',
        'ac',
        'gov',
        'edu',
      ];
      if (
        parts.length >= 3 &&
        secondLevelDomains.includes(parts[parts.length - 2])
      ) {
        domain = parts.slice(-3).join('.');
      }
    }

    return domain;
  } catch (e) {
    console.error('Error extracting domain:', e);
    return '';
  }
}
