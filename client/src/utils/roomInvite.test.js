import { describe, expect, it } from 'vitest'
import { createInviteLink, readInviteRoom } from './roomInvite'

describe('room invitations', () => {
  it('shares the room without existing query parameters or fragments', () => {
    const link = createInviteLink('https://poker.example/play?token=secret&preview=lobby#private', 'abc123')
    expect(link).toBe('https://poker.example/play?room=abc123')
    expect(readInviteRoom(link)).toBe('abc123')
  })
  it.each(['https://poker.example/', 'https://poker.example/?room=%3Cscript%3E', 'https://poker.example/?room=1234567890123'])('ignores absent or malformed room parameters: %s', href => {
    expect(readInviteRoom(href)).toBe('')
  })
})
