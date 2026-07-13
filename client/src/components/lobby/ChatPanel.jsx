import { MessageCircle, Send } from 'lucide-react'
import { Button } from '../ui/Primitives'
import styles from './ChatPanel.module.css'

export default function ChatPanel({ messages, draft, onDraftChange, onSend }) {
  return (
    <section className={styles.panel} aria-label="牌桌聊天">
      <header>
        <MessageCircle aria-hidden="true" size={18} />
        <div>
          <h2>牌桌聊天</h2>
          <p>与房间内的玩家交流</p>
        </div>
      </header>

      <div className={styles.messages} aria-live="polite">
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <MessageCircle aria-hidden="true" size={24} />
            <span>还没有消息，先打个招呼吧。</span>
          </div>
        ) : messages.map((message, index) => (
          <article className={styles.message} key={message.id ?? `${message.sender}-${index}`}>
            <div className={styles.messageMeta}>
              <strong>{message.sender || '牌友'}</strong>
              {message.isSpectator && <span>旁观者</span>}
            </div>
            <p>{message.message}</p>
          </article>
        ))}
      </div>

      <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); onSend() }}>
        <label htmlFor="lobby-chat-message">发送消息</label>
        <input
          id="lobby-chat-message"
          type="text"
          autoComplete="off"
          maxLength={300}
          placeholder="输入消息…"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <Button type="submit" disabled={!draft.trim()} aria-label="发送消息">
          <Send aria-hidden="true" size={17} />
        </Button>
      </form>
    </section>
  )
}
