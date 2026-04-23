import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Circle, Line, Group } from '@shopify/react-native-skia';

const CELL_SIZE = 24;
const ROWS = 6;
const COLS = 12;

const MOCK_DATA = [
  'B', 'P', 'B', 'B', 'P', 'T', 'B', 'P', 'P', 'B', 'B', 'B', 'T', 'P', 'P'
];

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
        color="#e8e8e8"
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
        color="#e8e8e8"
        strokeWidth={1}
      />
    );
  }

  return <Group>{lines}</Group>;
};

const BeadRoad = () => {
  return (
    <Canvas style={{ width: COLS * CELL_SIZE, height: ROWS * CELL_SIZE }}>
      <Grid rows={ROWS} cols={COLS} cellSize={CELL_SIZE} />
      {MOCK_DATA.map((result, index) => {
        const col = Math.floor(index / ROWS);
        const row = index % ROWS;
        const cx = col * CELL_SIZE + CELL_SIZE / 2;
        const cy = row * CELL_SIZE + CELL_SIZE / 2;
        const radius = CELL_SIZE / 2 - 4;

        let color = '#000000';
        if (result === 'B') color = '#ff3b30'; // 庄
        if (result === 'P') color = '#007aff'; // 闲
        if (result === 'T') color = '#4cd964'; // 和

        return (
          <Circle
            key={`bead-${index}`}
            cx={cx}
            cy={cy}
            r={radius}
            color={color}
          />
        );
      })}
    </Canvas>
  );
};

const BigRoad = () => {
  const columns: string[][] = [];
  let currentResult = '';

  MOCK_DATA.forEach(result => {
    if (result === 'T') return;
    if (result !== currentResult) {
      columns.push([result]);
      currentResult = result;
    } else {
      const lastCol = columns[columns.length - 1];
      if (lastCol.length < ROWS) {
        lastCol.push(result);
      } else {
        columns.push([result]);
      }
    }
  });

  return (
    <Canvas style={{ width: COLS * CELL_SIZE, height: ROWS * CELL_SIZE }}>
      <Grid rows={ROWS} cols={COLS} cellSize={CELL_SIZE} />
      {columns.map((colData, colIndex) => {
        return colData.map((result, rowIndex) => {
          const cx = colIndex * CELL_SIZE + CELL_SIZE / 2;
          const cy = rowIndex * CELL_SIZE + CELL_SIZE / 2;
          const radius = CELL_SIZE / 2 - 4;

          let color = '#000000';
          if (result === 'B') color = '#ff3b30';
          if (result === 'P') color = '#007aff';

          return (
            <Circle
              key={`big-${colIndex}-${rowIndex}`}
              cx={cx}
              cy={cy}
              r={radius}
              color={color}
              style="stroke"
              strokeWidth={2}
            />
          );
        });
      })}
    </Canvas>
  );
};

export const FiveRoadsChart: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>五路图 (Five Roads Chart)</Text>
      
      <View style={styles.roadContainer}>
        <Text style={styles.roadTitle}>珠盘路 (Bead Road)</Text>
        <View style={styles.chartArea}>
          <BeadRoad />
        </View>
      </View>

      <View style={styles.roadContainer}>
        <Text style={styles.roadTitle}>大路 (Big Road)</Text>
        <View style={styles.chartArea}>
          <BigRoad />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  roadContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  roadTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
    alignSelf: 'flex-start',
  },
  chartArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
});

export default FiveRoadsChart;