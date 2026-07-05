import { test, expect } from '@playwright/test'
import { selectStation } from './helpers'

test.describe('MRT golden-path flows', () => {
  test('pick origin and destination, see fare and schedule results', async ({
    page,
  }) => {
    await page.goto('/mrt')
    await page.waitForSelector('text=Jadwal MRT Jakarta', { timeout: 30000 })

    await selectStation(page, 'Pilih Stasiun Asal', 'Lebak Bulus')
    await selectStation(page, 'Pilih Stasiun Tujuan', 'Bundaran HI')

    await expect(page.locator('text=Rp').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Arah Bundaran HI')).toBeVisible()

    await expect(page.locator('text=Kereta Berikutnya')).toBeVisible()
    const departureRows = page.getByTestId('mrt-departure-row')
    await expect(departureRows.first()).toBeVisible()
    await expect(departureRows.first().locator('text=tiba')).toBeVisible()
  })

  test('same station for origin and destination shows flat penalty fare', async ({
    page,
  }) => {
    await page.goto('/mrt')
    await page.waitForSelector('text=Jadwal MRT Jakarta', { timeout: 30000 })

    let fareCallCount = 0
    await page.route('**/api/mrt/fare*', (route) => {
      fareCallCount++
      route.continue()
    })

    await selectStation(page, 'Pilih Stasiun Asal', 'Lebak Bulus')
    await selectStation(page, 'Pilih Stasiun Tujuan', 'Lebak Bulus')

    await expect(page.locator('text=Stasiun asal dan tujuan sama')).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator('text=Rp 4.000')).toBeVisible()
    expect(fareCallCount).toBe(0)
  })

  test('fare fetch failure shows retry button, retry succeeds', async ({
    page,
  }) => {
    let isFirstCall = true

    await page.route('**/api/mrt/fare*', (route) => {
      if (isFirstCall) {
        isFirstCall = false
        route.fulfill({ status: 500, body: 'Server error' })
      } else {
        route.continue()
      }
    })

    await page.goto('/mrt')
    await page.waitForSelector('text=Jadwal MRT Jakarta', { timeout: 30000 })

    await selectStation(page, 'Pilih Stasiun Asal', 'Lebak Bulus')
    await selectStation(page, 'Pilih Stasiun Tujuan', 'Bundaran HI')

    await expect(
      page.locator('text=Gagal memuat tarif dan jadwal, coba lagi')
    ).toBeVisible({ timeout: 15000 })

    await page.locator('button').filter({ hasText: 'Coba Lagi' }).click()

    await expect(page.locator('text=Rp').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Kereta Berikutnya')).toBeVisible()
  })
})
