import { Page } from '@playwright/test'

export async function selectStation(page: Page, buttonLabel: string, searchText: string) {
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
