import { Crown, DoorOpen, RotateCcw, Trophy } from 'lucide-react'
import ModalDialog from './ui/ModalDialog'
import { Button } from './ui/Primitives'
import { rankPlayers } from './resultModels'
import styles from './Leaderboard.module.css'

export default function Leaderboard({ players, isRoomCreator, onNewGame, onLeaveRoom, onCloseRoom, onClose }) {
  const sortedPlayers = rankPlayers(players)
  const totalChips = sortedPlayers.reduce((total, player) => total + (Number(player.chips) || 0), 0)
  const footer = (
    <>
      <Button variant="ghost" onClick={onLeaveRoom}><DoorOpen size={16} />离开房间</Button>
      {isRoomCreator && <Button variant="danger" onClick={onCloseRoom}>关闭房间</Button>}
      {isRoomCreator && <Button onClick={onNewGame}><RotateCcw size={16} />开始新游戏</Button>}
    </>
  )

  return (
    <ModalDialog
      title="最终排行榜"
      eyebrow="Game complete"
      description={`${sortedPlayers.length} 位玩家 · 共 ${totalChips.toLocaleString('zh-CN')} 筹码`}
      closeLabel="关闭排行榜"
      onClose={onClose}
      footer={footer}
    >
      <div className={styles.summary}>
        <Trophy size={20} />
        <div>
          <span>本局冠军</span>
          <strong>{sortedPlayers[0]?.nickname ?? '暂无玩家'}</strong>
        </div>
        {sortedPlayers[0] && <b>{Number(sortedPlayers[0].chips).toLocaleString('zh-CN')}</b>}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>按剩余筹码从高到低排列的玩家排行榜</caption>
          <thead>
            <tr><th scope="col">排名</th><th scope="col">玩家</th><th scope="col">剩余筹码</th></tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, index) => (
              <tr key={player.id ?? `${player.nickname}-${index}`} className={index === 0 ? styles.champion : ''}>
                <td><span className={styles.rank}>{index === 0 && <Crown size={16} />}{index + 1}</span></td>
                <th scope="row">{player.nickname}</th>
                <td>{Number(player.chips || 0).toLocaleString('zh-CN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalDialog>
  )
}
