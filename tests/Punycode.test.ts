import { describe, expect, it } from "vitest"
import { punycodeToUnicode } from "../utils/Punycode"

describe("punycodeToUnicode", () => {
  it("decodes IDN hostnames", () => {
    expect(punycodeToUnicode("xn--mnchen-3ya.de")).toBe("münchen.de")
    expect(punycodeToUnicode("xn--bcher-kva.example")).toBe("bücher.example")
    expect(punycodeToUnicode("xn--fiqs8s")).toBe("中国")
    expect(punycodeToUnicode("xn--fiq228c42rmna.xn--fiqs8s")).toBe("中文网络.中国")
    expect(punycodeToUnicode("xn--e1afmkfd.xn--p1ai")).toBe("пример.рф")
    expect(punycodeToUnicode("xn--ls8h.la")).toBe("💩.la")
  })

  it("decodes only the punycode labels", () => {
    expect(punycodeToUnicode("www.xn--mnchen-3ya.de")).toBe("www.münchen.de")
    // Matches Node's punycode.toUnicode: uppercase labels are left alone
    expect(punycodeToUnicode("XN--MNCHEN-3YA.de")).toBe("XN--MNCHEN-3YA.de")
  })

  it("leaves plain hostnames untouched", () => {
    expect(punycodeToUnicode("example.com")).toBe("example.com")
    expect(punycodeToUnicode("")).toBe("")
  })

  it("returns the label unchanged when it is not valid punycode", () => {
    expect(punycodeToUnicode("xn--.com")).toBe("xn--.com")
    expect(punycodeToUnicode("xn--mnchen-.com")).toBe("xn--mnchen-.com")
    expect(punycodeToUnicode("xn--mnchen-3y!.com")).toBe("xn--mnchen-3y!.com")
    expect(punycodeToUnicode("xn--zzzzzzzzzzzz.com")).toBe("xn--zzzzzzzzzzzz.com")
  })
})
