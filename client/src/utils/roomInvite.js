// Share only the room identifier, never session credentials or preview parameters.
export function createInviteLink(href, roomId) {
  const url = new URL(href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('room', roomId)
  return url.href
}

export function readInviteRoom(href) {
  const room = new URL(href).searchParams.get('room')?.trim() ?? ''
  return /^[a-zA-Z0-9]{1,12}$/.test(room) ? room : ''
}
