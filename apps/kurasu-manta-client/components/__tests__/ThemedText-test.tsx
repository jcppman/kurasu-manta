import * as React from 'react'
import renderer, { act } from 'react-test-renderer'

// Mock the dependencies
jest.mock('@/hooks/useColorScheme')
jest.mock('@/constants/Colors')

import { ThemedText } from '../ThemedText'

describe('ThemedText', () => {
  it('renders correctly', () => {
    let tree: ReturnType<typeof renderer.create> | null = null

    act(() => {
      tree = renderer.create(<ThemedText>Snapshot test!</ThemedText>).toJSON()
    })

    expect(tree).toMatchSnapshot()
  })
})
