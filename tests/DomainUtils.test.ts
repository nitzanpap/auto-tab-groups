import { describe, it, expect } from "vitest";
import {
  extractDomain,
  getDomainDisplayName,
  validateStrictDomain,
  isIPAddress,
} from "../utils/DomainUtils";

describe("DomainUtils", () => {
  describe("extractDomain", () => {
    it("should extract domain from simple URL", () => {
      expect(extractDomain("https://example.com")).toBe("example.com");
    });

    it("should extract domain from URL with path", () => {
      expect(extractDomain("https://example.com/path/to/page")).toBe(
        "example.com",
      );
    });

    it("should extract domain from URL with www", () => {
      expect(extractDomain("https://www.example.com")).toBe("example.com");
    });

    it("should extract domain from URL with subdomain when not including subdomain", () => {
      expect(extractDomain("https://blog.example.com")).toBe("example.com");
    });

    it("should include subdomain when requested", () => {
      expect(extractDomain("https://blog.example.com", true)).toBe(
        "blog.example.com",
      );
    });

    it("should handle country code SLDs correctly (co.uk)", () => {
      expect(extractDomain("https://www.bbc.co.uk")).toBe("bbc.co.uk");
    });

    it("should handle country code SLDs correctly (com.au)", () => {
      expect(extractDomain("https://news.abc.com.au")).toBe("abc.com.au");
    });

    it("should handle country code SLDs with subdomain (co.il)", () => {
      expect(extractDomain("https://www.ynet.co.il")).toBe("ynet.co.il");
    });

    it("should return system for chrome:// URLs", () => {
      expect(extractDomain("chrome://settings")).toBe("system");
    });

    it("should return system for chrome-extension:// URLs", () => {
      expect(extractDomain("chrome-extension://abcdef/popup.html")).toBe(
        "system",
      );
    });

    it("should return system for moz-extension:// URLs", () => {
      expect(extractDomain("moz-extension://abcdef/popup.html")).toBe("system");
    });

    it("should return system for about: URLs", () => {
      expect(extractDomain("about:blank")).toBe("system");
    });

    it("should return null for empty string", () => {
      expect(extractDomain("")).toBe(null);
    });

    it("should return null for undefined", () => {
      expect(extractDomain(undefined as unknown as string)).toBe(null);
    });

    it("should return system for invalid URLs", () => {
      expect(extractDomain("not-a-valid-url")).toBe("system");
    });

    it("should handle URLs with ports", () => {
      expect(extractDomain("https://example.com:8080/path")).toBe(
        "example.com",
      );
    });

    it("should handle localhost", () => {
      expect(extractDomain("http://localhost")).toBe("system");
    });
  });

  describe("getDomainDisplayName", () => {
    it("should return display name for simple domain", () => {
      expect(getDomainDisplayName("example.com")).toBe("example");
    });

    it('should return "System" for system domain', () => {
      expect(getDomainDisplayName("system")).toBe("System");
    });

    it("should remove www prefix", () => {
      expect(getDomainDisplayName("www.example.com")).toBe("example");
    });

    it("should handle country code SLDs (co.uk)", () => {
      expect(getDomainDisplayName("bbc.co.uk")).toBe("bbc");
    });

    it("should handle country code SLDs (com.au)", () => {
      expect(getDomainDisplayName("abc.com.au")).toBe("abc");
    });

    it("should handle subdomains with ccSLDs", () => {
      expect(getDomainDisplayName("news.bbc.co.uk")).toBe("news.bbc");
    });

    it("should capitalize single word domains", () => {
      expect(getDomainDisplayName("localhost")).toBe("Localhost");
    });

    it("should return empty string for empty input", () => {
      expect(getDomainDisplayName("")).toBe("");
    });

    it("should return domain if only TLD after removal", () => {
      // Edge case: when domain is just tld.tld
      expect(getDomainDisplayName("co.uk")).toBe("co.uk");
    });
  });

  describe("validateStrictDomain", () => {
    it("should validate correct domain", () => {
      const result = validateStrictDomain("example.com");
      expect(result.isValid).toBe(true);
      expect(result.error).toBe(null);
    });

    it("should validate domain with subdomain", () => {
      const result = validateStrictDomain("blog.example.com");
      expect(result.isValid).toBe(true);
    });

    it("should reject empty string", () => {
      const result = validateStrictDomain("");
      expect(result.isValid).toBe(false);
      // Empty string is falsy, so it triggers the first check
      expect(result.error).toBe("Domain must be a string");
    });

    it("should reject null", () => {
      const result = validateStrictDomain(null as unknown as string);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Domain must be a string");
    });

    it("should reject wildcards", () => {
      const result = validateStrictDomain("*.example.com");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Wildcards not allowed in domain format");
    });

    it("should reject domain starting with dot", () => {
      const result = validateStrictDomain(".example.com");
      expect(result.isValid).toBe(false);
    });

    it("should reject domain ending with dot", () => {
      const result = validateStrictDomain("example.com.");
      expect(result.isValid).toBe(false);
    });

    it("should reject domain with consecutive dots", () => {
      const result = validateStrictDomain("example..com");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Domain cannot contain consecutive dots");
    });

    it("should reject domain starting with hyphen", () => {
      const result = validateStrictDomain("-example.com");
      expect(result.isValid).toBe(false);
    });

    it("should reject domain ending with hyphen", () => {
      // The check is for the whole domain ending with hyphen, not parts
      const result = validateStrictDomain("example.com-");
      expect(result.isValid).toBe(false);
    });

    it("should allow hyphen in middle of domain part", () => {
      // Hyphens in the middle are valid (e.g., my-website.com)
      const result = validateStrictDomain("my-website.com");
      expect(result.isValid).toBe(true);
    });

    it("should reject domain exceeding max length", () => {
      const longDomain = "a".repeat(250) + ".com";
      const result = validateStrictDomain(longDomain);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Domain too long (max 253 characters)");
    });
  });

  describe("isIPAddress", () => {
    it("should return true for valid IPv4 address", () => {
      expect(isIPAddress("192.168.1.1")).toBe(true);
    });

    it("should return true for valid IPv4 loopback", () => {
      expect(isIPAddress("127.0.0.1")).toBe(true);
    });

    it("should return true for IPv4 with 0.0.0.0", () => {
      expect(isIPAddress("0.0.0.0")).toBe(true);
    });

    it("should return false for invalid IPv4 (value > 255)", () => {
      expect(isIPAddress("256.1.1.1")).toBe(false);
    });

    it("should return false for regular domain", () => {
      expect(isIPAddress("example.com")).toBe(false);
    });

    it("should return true for IPv6 address", () => {
      expect(isIPAddress("::1")).toBe(true);
    });

    it("should return true for full IPv6 address", () => {
      expect(isIPAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);
    });
  });
});
