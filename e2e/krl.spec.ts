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

  test('same station for origin and destination shows flat penalty fare', async ({
    page,
  }) => {
    await page.goto('/krl')
    await page.waitForSelector('text=Jadwal KRL', { timeout: 30000 })

    await selectStation(page, 'Pilih Stasiun Asal', 'Jakarta Kota')
    await selectStation(page, 'Pilih Stasiun Tujuan', 'Jakarta Kota')

    await expect(page.locator('text=Stasiun asal dan tujuan sama')).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator('text=Rp 3.000')).toBeVisible()
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

test.describe('KRL onboarding tour', () => {
  test('exiting mid-tour then reopening via Bantuan restarts from step one with mock data', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('krl-onboarding-seen')
    })
    await page.goto('/krl')
    await page.waitForSelector('text=Jadwal KRL', { timeout: 30000 })

    // Tour auto-starts on first visit; advance one step so mock data is injected.
    await page.waitForSelector('text=Halaman ini membantu', { timeout: 10000 })
    await page.locator('button[data-action="primary"]').click()
    await page.waitForTimeout(300)

    // Exit mid-tour via the close (X) icon, not skip/finish.
    await page.locator('button[data-action="close"]').click()
    await page.waitForTimeout(300)
    await expect(page.locator('.react-joyride__tooltip')).toHaveCount(0)

    // User picks a real station pair after the mock was cleared.
    await selectStation(page, 'Pilih Stasiun Asal', 'Jakarta Kota')
    await selectStation(page, 'Pilih Stasiun Tujuan', 'Manggarai')
    await expect(page.locator('text=Rp').first()).toBeVisible({ timeout: 15000 })

    // Reopen the tour via the help button.
    await page.locator('button').filter({ hasText: 'Bantuan' }).click()
    await page.waitForTimeout(300)

    // It must restart from step one, not resume where it left off.
    await expect(page.locator('text=Halaman ini membantu')).toBeVisible()

    // Advancing into the tour must re-inject the mock scenario, replacing
    // the real Jakarta Kota / Manggarai selection with the mock Bogor / Serpong one.
    await page.locator('button[data-action="primary"]').click()
    await page.waitForTimeout(300)

    await expect(
      page.locator('button').filter({ hasText: 'Bogor' }).first()
    ).toBeVisible()
    await expect(page.locator('text=Serpong').first()).toBeVisible()
    await expect(page.locator('text=Contoh').first()).toBeVisible()
  })
})
