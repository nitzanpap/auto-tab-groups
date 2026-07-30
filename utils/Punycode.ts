/**
 * Punycode (RFC 3492) decoding for displaying IDN domains as Unicode.
 *
 * ponytail: decode only — group titles are the only place we need Unicode,
 * and browsers hand us ASCII hostnames everywhere else. No encoder, no dependency.
 */

const BASE = 36
const TMIN = 1
const TMAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128
const MAX_CODE_POINT = 0x10ffff

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let d = firstTime ? Math.floor(delta / DAMP) : delta >> 1
  d += Math.floor(d / numPoints)

  let k = 0
  while (d > ((BASE - TMIN) * TMAX) / 2) {
    d = Math.floor(d / (BASE - TMIN))
    k += BASE
  }

  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW))
}

/** Maps a basic code point to its digit value, or -1 if it isn't a valid digit */
function digitValue(code: number): number {
  if (code >= 0x30 && code <= 0x39) return code - 0x30 + 26 // 0-9
  if (code >= 0x61 && code <= 0x7a) return code - 0x61 // a-z
  if (code >= 0x41 && code <= 0x5a) return code - 0x41 // A-Z
  return -1
}

/**
 * Decodes a single punycode label (without the "xn--" prefix).
 * Returns null if the input is not valid punycode.
 */
function decodeLabel(input: string): string | null {
  const delimiter = input.lastIndexOf("-")
  const basic = delimiter > 0 ? input.slice(0, delimiter) : ""

  const output: number[] = []
  for (const char of basic) {
    const code = char.codePointAt(0) as number
    if (code >= 0x80) return null // basic part must be ASCII
    output.push(code)
  }

  let n = INITIAL_N
  let bias = INITIAL_BIAS
  let i = 0
  let index = delimiter > 0 ? delimiter + 1 : 0

  if (index >= input.length) return null // nothing encoded

  while (index < input.length) {
    const oldI = i
    let weight = 1

    for (let k = BASE; ; k += BASE) {
      if (index >= input.length) return null // truncated sequence

      const digit = digitValue(input.charCodeAt(index++))
      if (digit < 0 || digit > (MAX_CODE_POINT - i) / weight) return null

      i += digit * weight

      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
      if (digit < t) break

      weight *= BASE - t
    }

    const outLength = output.length + 1
    bias = adapt(i - oldI, outLength, oldI === 0)

    n += Math.floor(i / outLength)
    i %= outLength

    if (n > MAX_CODE_POINT) return null

    output.splice(i, 0, n)
    i++
  }

  return String.fromCodePoint(...output)
}

/**
 * Converts punycode labels in a hostname to Unicode.
 * Labels that aren't punycode, or that fail to decode, are returned unchanged.
 * @example punycodeToUnicode("xn--mnchen-3ya.de") // "münchen.de"
 */
export function punycodeToUnicode(hostname: string): string {
  return hostname
    .split(".")
    .map(label => {
      // ponytail: hostnames from URL.hostname are always lowercase
      if (!label.startsWith("xn--")) return label
      return decodeLabel(label.slice(4)) ?? label
    })
    .join(".")
}
