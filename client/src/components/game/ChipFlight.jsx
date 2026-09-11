import { formatChips } from './tableLayout'
import styles from './ChipFlight.module.css'


// 筹码飞行：下注时从座位飞向底池（toPot），派彩时从底池飞向赢家座位（toSeat）。
// 座位坐标复用 arrangePlayers 计算出的百分比位置，无需测量 DOM。
export default function ChipFlight({ flight, placements, pot }) {
  const placement = placements.find((item) => item.player.id === flight.playerId)
  if (!placement) return null

  const seatX = `${flight.direction === 'toSeat' ? placement.x : placement.bet.x}%`
  const seatY = `${flight.direction === 'toSeat' ? placement.y : placement.bet.y}%`
  const POT_X = `${pot.x}%`
  const POT_Y = `${pot.y}%`
  const [fromX, fromY, toX, toY] = flight.direction === 'toSeat'
    ? [POT_X, POT_Y, seatX, seatY]
    : [seatX, seatY, POT_X, POT_Y]

  return (
    <span
      className={styles.flight}
      style={{ '--from-x': fromX, '--from-y': fromY, '--to-x': toX, '--to-y': toY }}
      aria-hidden="true"
    >
      <span className={styles.chips}>
        <i /><i /><i />
      </span>
      {flight.amount > 0 && <small>{formatChips(flight.amount)}</small>}
    </span>
  )
}
