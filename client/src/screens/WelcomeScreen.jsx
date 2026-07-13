import { Club, Spade } from 'lucide-react'
import { Button, Input } from '../components/ui/Primitives'
import { Icon } from '../components/ui/Icon'
import styles from './WelcomeScreen.module.css'

export default function WelcomeScreen({
  nickname,
  roomId,
  onNicknameChange,
  onRoomIdChange,
  onCreateRoom,
  onJoinRoom,
}) {
  const canCreate = nickname.trim().length > 0
  const canJoin = canCreate && roomId.trim().length > 0

  return (
    <main className={styles.screen}>
      <div className={styles.ambient} aria-hidden="true">
        <Spade />
        <Club />
      </div>

      <section className={styles.intro} aria-labelledby="welcome-title">
        <div className={styles.eyebrow}><Icon name="spade" size={16} /> 私人牌局</div>
        <h1 id="welcome-title">德州扑克</h1>
        <p className={styles.englishTitle}>Texas Hold&apos;em</p>
        <p className={styles.lead}>建立房间，邀请牌友，在一张专注而清晰的牌桌上完成每一次决策。</p>
        <div className={styles.rules}>
          <span>2–8 位玩家</span>
          <span>实时对局</span>
          <span>断线重连</span>
        </div>
      </section>

      <section className={styles.entry} aria-label="进入牌局">
        <header>
          <span className={styles.step}>01</span>
          <div>
            <h2>进入牌桌</h2>
            <p>先设定牌桌上显示的昵称。</p>
          </div>
        </header>

        <Input
          id="nickname"
          label="昵称"
          autoComplete="nickname"
          maxLength={20}
          placeholder="例如：河牌猎手"
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
        />

        <form onSubmit={(event) => { event.preventDefault(); if (canCreate) onCreateRoom() }}>
          <Button type="submit" disabled={!canCreate} className={styles.fullButton}>
            <Icon name="plus" />创建新房间
          </Button>
        </form>

        <div className={styles.divider}><span>或加入已有牌局</span></div>

        <form
          className={styles.joinForm}
          onSubmit={(event) => { event.preventDefault(); if (canJoin) onJoinRoom() }}
        >
          <Input
            id="room-id"
            label="房间号"
            autoCapitalize="none"
            autoComplete="off"
            maxLength={12}
            placeholder="输入房间号"
            value={roomId}
            onChange={(event) => onRoomIdChange(event.target.value)}
          />
          <Button type="submit" variant="ghost" disabled={!canJoin}>
            <Icon name="login" />加入房间
          </Button>
        </form>

        <p className={styles.note}>创建房间后，将房间号发送给牌友；至少两位玩家即可开始。</p>
      </section>
    </main>
  )
}
