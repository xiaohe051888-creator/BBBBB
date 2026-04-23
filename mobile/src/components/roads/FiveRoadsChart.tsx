import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Canvas, Circle, Line, Group, Path, Paint } from '@shopify/react-native-skia';
import { useGameState } from '../../hooks/useGameState';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = 20; // 缩小单元格尺寸以适应手机屏幕
const ROWS = 6;
const VISIBLE_COLS = Math.floor((SCREEN_WIDTH - 32) / CELL_SIZE); // 根据屏幕宽度动态计算可见列数

const Grid = ({ rows, cols, cellSize }: { rows: number; cols: number; cellSize: number }) => {
  const width = cols * cellSize;
  const height = rows * cellSize;
  const lines = [];

  for (let i = 0; i <= rows; i++) {
    lines.push(
      <Line
        key={`h-${i}`}
        p1={{ x: 0, y: i * cellSize }}
        p2={{ x: width, y: i * cellSize }}
        color="#30363d"
        strokeWidth={1}
      />
    );
  }

  for (let i = 0; i <= cols; i++) {
    lines.push(
      <Line
        key={`v-${i}`}
        p1={{ x: i * cellSize, y: 0 }}
        p2={{ x: i * cellSize, y: height }}
        color="#30363d"
        strokeWidth={1}
      />
    );
  }

  return <Group>{lines}</Group>;
};

const BeadRoad = ({ data, cols }: { data: string[]; cols: number }) => {
  return (
    <Canvas style={{ width: cols * CELL_SIZE, height: ROWS * CELL_SIZE }}>
      <Grid rows={ROWS} cols={cols} cellSize={CELL_SIZE} />
      {data.map((result, index) => {
        const col = Math.floor(index / ROWS);
        const row = index % ROWS;
        const cx = col * CELL_SIZE + CELL_SIZE / 2;
        const cy = row * CELL_SIZE + CELL_SIZE / 2;
        const radius = CELL_SIZE / 2 - 2;

        let color = 'transparent';
        if (result === '庄') color = '#ff4d4f'; // 庄红
        if (result === '闲') color = '#1890ff'; // 闲蓝
        if (result === '和') color = '#52c41a'; // 和绿

        if (color === 'transparent') return null;

        return (
          <Group key={`bead-${index}`}>
            <Circle cx={cx} cy={cy} r={radius} color={color} />
          </Group>
        );
      })}
    </Canvas>
  );
};

const BigRoad = ({ data, cols }: { data: string[]; cols: number }) => {
  // 简化的大路逻辑：连续的结果排在一列，遇到和局不占新列，只在圆圈上加绿线
  const columns: { result: string; ties: number }[][] = [];
  let currentResult = '';

  data.forEach(result => {
    if (result === '和') {
      if (columns.length > 0) {
        const lastCol = columns[columns.length - 1];
        const lastItem = lastCol[lastCol.length - 1];
        lastItem.ties += 1;
      }
      return;
    }
    if (result !== currentResult) {
      columns.push([{ result, ties: 0 }]);
      currentResult = result;
    } else {
      const lastCol = columns[columns.length - 1];
      if (lastCol.length < ROWS) {
        lastCol.push({ result, ties: 0 });
      } else {
        columns.push([{ result, ties: 0 }]);
      }
    }
  });

  return (
    <Canvas style={{ width: cols * CELL_SIZE, height: ROWS * CELL_SIZE }}>
      <Grid rows={ROWS} cols={cols} cellSize={CELL_SIZE} />
      {columns.map((colData, colIndex) => {
        return colData.map((item, rowIndex) => {
          const cx = colIndex * CELL_SIZE + CELL_SIZE / 2;
          const cy = rowIndex * CELL_SIZE + CELL_SIZE / 2;
          const radius = CELL_SIZE / 2 - 2;

          let color = 'transparent';
          if (item.result === '庄') color = '#ff4d4f';
          if (item.result === '闲') color = '#1890ff';

          if (color === 'transparent') return null;

          return (
            <Group key={`big-${colIndex}-${rowIndex}`}>
              <Circle cx={cx} cy={cy} r={radius} color={color} style="stroke" strokeWidth={2} />
              {/* 和局标记 (绿线穿过) */}
              {item.ties > 0 && (
                <Line 
                  p1={{ x: cx - radius + 2, y: cy + radius - 2 }} 
                  p2={{ x: cx + radius - 2, y: cy - radius + 2 }} 
                  color="#52c41a" 
                  strokeWidth={2} 
                />
              )}
            </Group>
          );
        });
      })}
    </Canvas>
  );
};

export const FiveRoadsChart: React.FC = () => {
  const { games } = useGameState();
  
  const rawData = useMemo(() => {
    return games ? games.map(g => g.result) : [];
  }, [games]);

  // 计算所需的列数，至少铺满屏幕，数据多时扩展列数以支持滚动
  const requiredBeadCols = Math.max(VISIBLE_COLS, Math.ceil(rawData.length / ROWS) + 1);
  const requiredBigCols = Math.max(VISIBLE_COLS, rawData.length + 2); // 粗略估算大路最大列数

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>百家乐走势图</Text>
        <Text style={styles.subtitle}>当前 {rawData.length} 局</Text>
      </View>

      <View style={styles.roadSection}>
        <Text style={styles.roadTitle}>珠盘路 (Bead Plate)</Text>
        <View style={styles.scrollWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.canvasContainer}>
              <BeadRoad data={rawData} cols={requiredBeadCols} />
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={styles.roadSection}>
        <Text style={styles.roadTitle}>大路 (Big Road)</Text>
        <View style={styles.scrollWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.canvasContainer}>
              <BigRoad data={rawData} cols={requiredBigCols} />
            </View>
          </ScrollView>
        </View>
      </View>

      {/* 图例 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ff4d4f' }]} />
          <Text style={styles.legendText}>庄赢</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#1890ff' }]} />
          <Text style={styles.legendText}>闲赢</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#52c41a' }]} />
          <Text style={styles.legendText}>和局</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    backgroundColor: '#161b22', // 暗色主题卡片
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#8b949e',
  },
  roadSection: {
    marginBottom: 20,
  },
  roadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c9d1d9',
    marginBottom: 8,
  },
  scrollWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  scrollContent: {
    flexGrow: 1,
  },
  canvasContainer: {
    backgroundColor: '#0d1117',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#8b949e',
    fontSize: 13,
  },
});

export default FiveRoadsChart;
