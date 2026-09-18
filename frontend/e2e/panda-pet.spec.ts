import { expect, test } from "@playwright/test"

test.describe("Panda AI Pet", () => {
  test("switches state, completes success, and remains inside the viewport after drag", async ({
    page,
  }) => {
    await page.goto("/dev/panda")
    const pet = page.getByTestId("panda-pet")
    const button = page.getByRole("button", { name: /Panda AI/i })

    await expect(button).toBeVisible()
    await page.getByRole("button", { name: "thinking", exact: true }).click()
    await expect(pet).toHaveAttribute("data-state", "thinking")

    await page.getByRole("button", { name: "success", exact: true }).click()
    await expect(pet).toHaveAttribute("data-state", "success")
    await expect(pet).toHaveAttribute("data-state", "idle", { timeout: 3500 })

    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(-100, -100, { steps: 5 })
    await page.mouse.up()

    const moved = await button.boundingBox()
    expect(moved).not.toBeNull()
    expect(moved!.x).toBeGreaterThanOrEqual(0)
    expect(moved!.y).toBeGreaterThanOrEqual(0)
  })

  test("shows the complete idle pose on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/dev/panda")
    const sprite = page.locator(".panda-sprite")
    await expect(sprite).toBeVisible()
    await expect(sprite).toHaveCSS("overflow", "visible")
    await expect(page.getByTestId("panda-pet")).toHaveAttribute(
      "data-state",
      "idle",
    )
  })

  test("stays idle without a user action instead of changing on a random timer", async ({
    page,
  }) => {
    await page.clock.install()
    await page.goto("/dev/panda")
    const pet = page.getByTestId("panda-pet")

    await expect(pet).toHaveAttribute("data-state", "idle")
    await page.clock.fastForward(30_000)
    await expect(pet).toHaveAttribute("data-state", "idle")
  })
})
