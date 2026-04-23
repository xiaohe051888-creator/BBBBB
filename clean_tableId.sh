#!/bin/bash
# Remove tableId parameter globally

# DashboardPage.tsx
sed -i 's/{ tableId }/\{\}/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/{ tableId, pageSize: 50 }/{ pageSize: 50 }/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/{ tableId, page: 1 }/{ page: 1 }/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/if (!tableId) return;//g' frontend/src/pages/DashboardPage.tsx
sed -i 's/api.getHealthScore(tableId)/api.getHealthScore()/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/, tableId//g' frontend/src/pages/DashboardPage.tsx
sed -i 's/tableId,//g' frontend/src/pages/DashboardPage.tsx
sed -i 's/&& tableId//g' frontend/src/pages/DashboardPage.tsx
sed -i 's/queryKeys.\([a-zA-Z0-9_]*\)(tableId)/queryKeys.\1()/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/queryKeys.games(tableId, 1)/queryKeys.games(1)/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/api.createWebSocket(tableId)/api.createWebSocket()/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/addLogOptimistically(tableId, /addLogOptimistically(/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/addBetOptimistically(tableId, /addBetOptimistically(/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/updateStateOptimistically(tableId, /updateStateOptimistically(/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/addGameOptimistically(tableId, /addGameOptimistically(/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/updateBetOptimistically(tableId, /updateBetOptimistically(/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/updateRoadsOptimistically(tableId, /updateRoadsOptimistically(/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/updateAnalysisOptimistically(tableId, /updateAnalysisOptimistically(/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/table_id: tableId,//g' frontend/src/pages/DashboardPage.tsx
sed -i 's/!gameNumber || !tableId/!gameNumber/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/mutateAsync({ tableId, result: revealResult })/mutateAsync({ result: revealResult })/g' frontend/src/pages/DashboardPage.tsx
sed -i 's/tableId={tableId || '"''"'}//g' frontend/src/pages/DashboardPage.tsx
sed -i "s/const { tableId } = useParams<{ tableId: string }>();/const tableId = 'global';/g" frontend/src/pages/DashboardPage.tsx
sed -i "s/mutateAsync({/mutateAsync({/g" frontend/src/pages/DashboardPage.tsx

# Replace specific things inside mutateAsync call in DashboardPage
sed -i 's/tableId: tableId,/ /g' frontend/src/pages/DashboardPage.tsx
sed -i 's/tableId,/ /g' frontend/src/pages/DashboardPage.tsx
sed -i 's/tableId: string/ /g' frontend/src/pages/DashboardPage.tsx

