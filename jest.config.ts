import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-node',
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
}

export default createJestConfig(config)
