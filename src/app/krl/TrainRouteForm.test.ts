import { getStoredFavorites, saveFavorites } from './TrainRouteForm'
import { IFavoriteRoute } from '../types'

function createMockWindow(storage: Record<string, string> = {}) {
  return {
    getItem: jest.fn((key: string) => storage[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      storage[key] = value
    }),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
}

function setWindowLocalStorage(mock: ReturnType<typeof createMockWindow>) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: mock },
    writable: true,
    configurable: true,
  })
}

function deleteWindowLocalStorage() {
  delete (globalThis as Record<string, unknown>).localStorage
  delete (globalThis as Record<string, unknown>).window
}

describe('getStoredFavorites', () => {
  afterEach(() => {
    deleteWindowLocalStorage()
  })

  test('returns empty array when window is undefined (SSR)', () => {
    deleteWindowLocalStorage()
    const result = getStoredFavorites()
    expect(result).toEqual([])
  })

  test('returns empty array when localStorage has no key', () => {
    const storage = createMockWindow()
    setWindowLocalStorage(storage)

    const result = getStoredFavorites()
    expect(result).toEqual([])
  })

  test('returns parsed favorites from localStorage', () => {
    const favorites: IFavoriteRoute[] = [
      {
        originStationId: 'AC',
        destinationStationId: 'BPR',
        region: 'Jabodetabek',
        savedAt: 1609459200000,
      },
    ]
    const storage = createMockWindow()
    storage.getItem.mockReturnValue(JSON.stringify(favorites))
    setWindowLocalStorage(storage)

    const result = getStoredFavorites()
    expect(result).toEqual(favorites)
  })

  test('returns empty array on corrupt JSON', () => {
    const storage = createMockWindow()
    storage.getItem.mockReturnValue('not-valid-json')
    setWindowLocalStorage(storage)

    const result = getStoredFavorites()
    expect(result).toEqual([])
  })
})

describe('saveFavorites', () => {
  afterEach(() => {
    deleteWindowLocalStorage()
  })

  test('does nothing when window is undefined (SSR)', () => {
    deleteWindowLocalStorage()
    const favorites: IFavoriteRoute[] = [
      {
        originStationId: 'AC',
        destinationStationId: 'BPR',
        region: 'Jabodetabek',
        savedAt: 1609459200000,
      },
    ]
    expect(() => saveFavorites(favorites)).not.toThrow()
  })

  test('saves favorites to localStorage', () => {
    const storage = createMockWindow()
    setWindowLocalStorage(storage)

    const favorites: IFavoriteRoute[] = [
      {
        originStationId: 'MRI',
        destinationStationId: 'THB',
        region: 'Jabodetabek',
        savedAt: 1609459200000,
      },
    ]
    saveFavorites(favorites)

    expect(storage.setItem).toHaveBeenCalledWith(
      'krl-favorites',
      JSON.stringify(favorites)
    )
  })

  test('full round-trip: save then get', () => {
    const store: Record<string, string> = {}
    const storage = createMockWindow(store)
    setWindowLocalStorage(storage)

    const favorites: IFavoriteRoute[] = [
      {
        originStationId: 'JAKK',
        destinationStationId: 'BOO',
        region: 'Jabodetabek',
        savedAt: Date.now(),
      },
    ]

    saveFavorites(favorites)

    const result = getStoredFavorites()
    expect(result).toEqual(favorites)
  })
})
