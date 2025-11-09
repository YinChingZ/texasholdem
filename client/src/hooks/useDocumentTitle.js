import { useEffect } from 'react';

const DEFAULT_TITLE = '德州扑克';
const YOUR_TURN_TITLE = '德州扑克:你的回合';
const WAITING_TITLE = '德州扑克:等待中';

export const useDocumentTitle = (gameState, currentPlayerId) => {
    useEffect(() => {
        let title = DEFAULT_TITLE;

        if (gameState) {
            const { gameState: state, currentPlayerTurn } = gameState;

            // 游戏未开始或已结束
            if (state === 'WAITING' || state === 'SHOWDOWN' || state === 'SHOWDOWN_COMPLETE') {
                title = DEFAULT_TITLE;
            }
            // 游戏进行中
            else if (state === 'PREFLOP' || state === 'FLOP' || state === 'TURN' || state === 'RIVER') {
                if (currentPlayerTurn === currentPlayerId) {
                    title = YOUR_TURN_TITLE;
                } else {
                    title = WAITING_TITLE;
                }
            }
        }

        document.title = title;

        // 清理函数：组件卸载时恢复默认标题
        return () => {
            document.title = DEFAULT_TITLE;
        };
    }, [gameState, currentPlayerId]);
};
