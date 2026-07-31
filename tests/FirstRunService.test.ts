import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mockBrowser } from "./setup"

// vi.mock is hoisted above module scope, so the spy has to be too
const { setValue } = vi.hoisted(() => ({ setValue: vi.fn() }))

vi.mock("../utils/storage", () => ({
  protectedGroupTitles: {
    setValue,
    getValue: vi.fn().mockResolvedValue([])
  }
}))

import { seedProtectedGroupsOnFirstRun } from "../services/FirstRunService"

/**
 * The seeding decides whether a run is the extension's first, which is the
 * only moment it can tell a user's own groups from its own.
 */
describe("seedProtectedGroupsOnFirstRun", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setValue.mockResolvedValue(undefined)
    mockBrowser.storage.local.get.mockResolvedValue({})
    mockBrowser.tabGroups.query.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should protect groups that exist on a first run", async () => {
    mockBrowser.tabGroups.query.mockResolvedValue([
      { id: 1, title: "Shopping" },
      { id: 2, title: "Reading" }
    ])

    const result = await seedProtectedGroupsOnFirstRun()

    expect(result).toEqual(["Shopping", "Reading"])
    expect(setValue).toHaveBeenCalledWith(["Shopping", "Reading"])
  })

  it("should do nothing when storage already has keys", async () => {
    mockBrowser.storage.local.get.mockResolvedValue({ autoGroupingEnabled: true })
    mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Shopping" }])

    const result = await seedProtectedGroupsOnFirstRun()

    expect(result).toEqual([])
    expect(setValue).not.toHaveBeenCalled()
  })

  it("should do nothing on a first run with no groups", async () => {
    const result = await seedProtectedGroupsOnFirstRun()

    expect(result).toEqual([])
    expect(setValue).not.toHaveBeenCalled()
  })

  it("should skip untitled groups", async () => {
    mockBrowser.tabGroups.query.mockResolvedValue([
      { id: 1, title: "Shopping" },
      { id: 2, title: "" },
      { id: 3, title: undefined }
    ])

    await seedProtectedGroupsOnFirstRun()

    expect(setValue).toHaveBeenCalledWith(["Shopping"])
  })

  it("should de-duplicate titles across windows", async () => {
    mockBrowser.tabGroups.query.mockResolvedValue([
      { id: 1, title: "Shopping", windowId: 1 },
      { id: 2, title: "Shopping", windowId: 2 }
    ])

    await seedProtectedGroupsOnFirstRun()

    expect(setValue).toHaveBeenCalledWith(["Shopping"])
  })

  it("should not block startup when the storage read fails", async () => {
    mockBrowser.storage.local.get.mockRejectedValue(new Error("storage unavailable"))

    await expect(seedProtectedGroupsOnFirstRun()).resolves.toEqual([])
  })

  it("should do nothing when the browser has no tab groups API", async () => {
    const original = mockBrowser.tabGroups
    // @ts-expect-error — simulating a browser without tabGroups
    mockBrowser.tabGroups = undefined

    try {
      await expect(seedProtectedGroupsOnFirstRun()).resolves.toEqual([])
      expect(setValue).not.toHaveBeenCalled()
    } finally {
      mockBrowser.tabGroups = original
    }
  })
})
