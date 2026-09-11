import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TrainingReport from './TrainingReport'
const before={playerId:'bot',street:'PREFLOP',board:[],pot:15,call:10,chips:1000,positions:{dealer:'hero',smallBlind:'bot',bigBlind:'hero'},players:[]}
const report={id:'test',version:'v1',finishedAt:1,completed:1,heroId:'hero',players:[{id:'hero',nickname:'我'},{id:'bot',nickname:'对手'}],opponents:[{id:'bot',nickname:'对手',profile:{label:'偏激进'},metrics:{vpip:{count:0,opportunities:0,hands:[]}}}],notes:[{playerId:'bot',text:'行动之后才写的判断',handNumber:0,activeHandNumber:1,actionIndex:1,confidence:'tentative',hands:[],at:2}],selected:[1],hands:[{number:1,handId:'h1',holes:[{playerId:'hero',hand:[{rank:'2',suit:'Hearts'}]},{playerId:'bot',hand:[{rank:'A',suit:'Spades'}]}],events:[{type:'action',before,action:'call',invested:10},{type:'action',before:{...before,street:'FLOP',board:[{rank:'K',suit:'Clubs'}]},action:'check',invested:0}],result:{communityCards:['Kc'],winners:[{playerId:'bot',amount:25}]}}]}
describe('evidence review',()=>{
 it('hides future cards, future notes and results until the appropriate step or reveal',()=>{
  render(<TrainingReport report={report} onBack={()=>{}} />)
  expect(screen.queryByText('训练额外揭示')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('这个行动前已有的观察记录'))
  expect(screen.getByText('当时尚无观察记录。')).toBeInTheDocument()
  expect(screen.queryByText(/派彩：/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'下一步'}))
  expect(screen.queryByText('当时尚无观察记录。')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'揭示底牌与后续结果'}))
  expect(screen.getByText('训练额外揭示')).toBeInTheDocument()
  expect(screen.getByText(/派彩：对手 25/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'上一步'}))
  expect(screen.queryByText('训练额外揭示')).not.toBeInTheDocument()
 })
 it('shows storage failure with a download fallback and no accuracy score',()=>{
  render(<TrainingReport report={report} onBack={()=>{}} saveError="存储不可用" />)
  expect(screen.getByRole('alert')).toHaveTextContent('存储不可用')
  expect(screen.getByRole('button',{name:'下载报告 JSON'})).toBeVisible()
  expect(screen.getByText(/暂无样本/)).toBeInTheDocument()
 })
})
