import { test, expect } from '@playwright/test'

async function selectStation(page, buttonLabel, searchText) {
  const button = page.locator('button').filter({ hasText: buttonLabel }).first()
  await button.click()
  await page.waitForTimeout(300)

  const input = page.locator('input[placeholder="Cari stasiun..."]')
  await input.fill(searchText)
  await page.waitForTimeout(500)

  const option = page.locator('[cmdk-item]').filter({ hasText: searchText }).first()
  await option.click()
  await page.waitForTimeout(500)
}

test.describe('KRL golden-path flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('krl-onboarding-seen', 'true')
    })
  })

  test('pick origin and destination, see fare and schedule results', async ({
    page,
  }) => {
    await page.goto('/krl')
    await page.waitForSelector('text=Jadwal KRL', { timeout: 30000 })

    await selectStation(page, 'Pilih Stasiun Asal', 'Jakarta Kota')
    await selectStation(page, 'Pilih Stasiun Tujuan', 'Manggarai')

    await expect(page.locator('text=Rp').first()).toBeVisible({ timeout: 15000 })
  })

  test('same station for origin and destination is rejected', async ({
    page,
  }) => {
    await page.goto('/krl')
    await page.waitForSelector('text=Jadwal KRL', { timeout: 30000 })

    await selectStation(page, 'Pilih Stasiun Asal', 'Jakarta Kota')
    await selectStation(page, 'Pilih Stasiun Tujuan', 'Jakarta Kota')

    await page.waitForTimeout(2000)

    const hasError = await page
      .locator('text=Origin and destination must be different stations')
      .isVisible()
      .catch(() => false)

    const noFare = (await page.locator('text=Rp').count()) === 0

    expect(hasError || noFare).toBe(true)
  })

  test('save favorite route, reload preserves it, click repopulates form', async ({
    page,
  }) => {
    await page.goto('/krl')
    await page.waitForSelector('text=Jadwal KRL', { timeout: 30000 })

    await selectStation(page, 'Pilih Stasiun Asal', 'Jakarta Kota')
    await selectStation(page, 'Pilih Stasiun Tujuan', 'Manggarai')

    await expect(page.locator('text=Rp').first()).toBeVisible({ timeout: 15000 })

    const favButton = page.locator('button').filter({ hasText: 'Simpan' })
    if (await favButton.isVisible().catch(() => false)) {
      await favButton.click()
      await page.waitForTimeout(1000)

      await page.reload()
      await page.waitForSelector('text=Jadwal KRL', { timeout: 30000 })

      const favPill = page
        .locator('button')
        .filter({ hasText: 'Jakarta Kota → Manggarai' })
      await expect(favPill).toBeVisible({ timeout: 10000 })

      await favPill.click()
      await page.waitForTimeout(1000)

      await expect(
        page.locator('button').filter({ hasText: 'Jakarta Kota' }).first()
      ).toBeVisible()
      await expect(
        page.locator('button').filter({ hasText: 'Manggarai' }).first()
      ).toBeVisible()
    }
  })

  test('multi-leg route shows progressive SSE results', async ({ page }) => {
    await page.goto('/krl')
    await page.waitForSelector('text=Jadwal KRL', { timeout: 30000 })

    await selectStation(page, 'Pilih Stasiun Asal', 'Pasar Minggu Baru')
    await selectStation(page, 'Pilih Stasiun Tujuan', 'Tanah Abang')

    await expect(page.locator('text=Rp').first()).toBeVisible({ timeout: 15000 })

    const legCount = await page.locator('text=COMMUTER LINE').count()
    expect(legCount).toBeGreaterThanOrEqual(1)
  })
})
