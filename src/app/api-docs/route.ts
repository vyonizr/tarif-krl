import { ApiReference } from '@scalar/nextjs-api-reference'

const config = {
  spec: {
    url: '/openapi.yaml',
  },
}

export const GET = ApiReference(config)
