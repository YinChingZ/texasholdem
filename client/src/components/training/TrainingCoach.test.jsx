import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import TrainingCoach from './TrainingCoach'
const analysis={street:'PREFLOP',handLabel:'同花起手牌',insights:['跟注门槛不是实际胜率。'],evidence:[{playerId:'b',name:'对手',text:'样本很少，暂缓定性。'}],prompt:'考虑哪些更弱牌会跟注。'}
it('shows post-action feedback, offers optional pre-action analysis and can pause or disable',()=>{
 const pause=vi.fn();render(<TrainingCoach coach={{current:analysis,latest:{...analysis,handNumber:1,actionIndex:2,actionLabel:'弃牌',takeaway:'本可免费过牌，弃牌没有节省筹码。'}}} onPause={pause} />)
 expect(screen.getByText('本可免费过牌，弃牌没有节省筹码。')).toBeVisible()
 expect(screen.getByText('行动前提示：查看当前局面').parentElement).not.toHaveAttribute('open')
 fireEvent.click(screen.getByText('行动前提示：查看当前局面'))
 expect(screen.getAllByText('跟注门槛不是实际胜率。').some(e=>e.closest('details[open]'))).toBe(true)
 fireEvent.click(screen.getByRole('button',{name:'暂停牌局，仔细阅读'}));expect(pause).toHaveBeenCalledOnce()
 fireEvent.click(screen.getByLabelText('开启实时反馈'));expect(screen.queryByText('本可免费过牌，弃牌没有节省筹码。')).not.toBeInTheDocument()
})
