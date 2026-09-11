export const TABLE_ANCHORS = { desktop: { pot: { x: 50, y: 45 }, board: { x: 50, y: 59 } }, mobile: { pot: { x: 50, y: 47 }, board: { x: 50, y: 61 } } }
export const formatChips = amount => Number(amount ?? 0).toLocaleString('zh-CN')

// All seats and chip flights use the same reading-order layout.
// Opponents occupy one or two rows; the local hand stays next to the controls.
export function layoutTable(placements, mobile, landscape = false, revealed = false) {
  const opponents = Math.max(0, placements.length - 1)
  const rows = !landscape && opponents > (mobile ? 3 : 4) ? 2 : 1
  const firstRowCount = rows === 1 ? opponents : mobile ? Math.min(3, Math.ceil(opponents / 2)) : Math.ceil(opponents / 2)
  const secondRowCount = opponents - firstRowCount
  const pot = { x: landscape ? 33 : 50, y: landscape ? 47 : rows === 2 ? (revealed ? 54 : 52) : 41 }
  const board = { x: landscape ? 33 : 50, y: landscape ? 70 : rows === 2 ? (revealed ? 68 : 66) : 59 }
  return { rows, pot, board, placements: placements.map((placement, index) => {
    if (index === 0) return { ...placement, x: landscape ? 75 : 50, y: landscape ? 72 : 89, bet: { x: landscape ? 75 : 50, y: landscape ? 47 : rows === 2 ? 77 : 74 }, columns: 1 }
    const opponentIndex = index - 1
    const isSecondRow = rows === 2 && opponentIndex >= firstRowCount
    const count = isSecondRow ? secondRowCount : firstRowCount
    const column = isSecondRow ? opponentIndex - firstRowCount : opponentIndex
    const width = count === 1 ? 0 : count === 2 ? 50 : count === 3 ? 68 : count === 4 ? 75 : 86
    const x = count === 1 ? 50 : 50 - width / 2 + column * width / (count - 1)
    const y = landscape ? 11 : rows === 2 ? (isSecondRow ? (revealed ? 34 : 31) : 10) : 17
    const bet = { x, y: y + (landscape ? 22 : 12) }
    return { ...placement, x, y, bet, columns: count }
  }) }
}
