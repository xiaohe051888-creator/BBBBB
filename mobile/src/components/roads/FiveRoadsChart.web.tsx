import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoadsQuery } from '../../hooks/useQueries';

export const FiveRoadsChart: React.FC = () => {
  const { data: roadsData, isLoading } = useRoadsQuery({});

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>加载走势图中...</Text>
      </View>
    );
  }

  if (!roadsData || !roadsData.roads) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>暂无走势数据</Text>
      </View>
    );
  }

  const renderGrid = (road: any, cellSize: number = 24) => {
    if (!road) return null;
    const { max_columns, max_rows, points, display_name } = road;
    
    // Ensure we render at least some columns to make it look like a grid
    const cols = Math.max(max_columns + 1, 10);
    const rows = Math.max(max_rows, 6);

    const grid: any[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));
    points.forEach((p: any) => {
      if (p.row < rows && p.column < cols) {
        grid[p.row][p.column] = p;
      }
    });

    return (
      <View style={styles.roadSection}>
        <Text style={styles.roadTitle}>{display_name}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.grid}>
            {grid.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.row}>
                {row.map((cell, colIndex) => (
                  <View 
                    key={`cell-${rowIndex}-${colIndex}`} 
                    style={[
                      styles.cell, 
                      { width: cellSize, height: cellSize },
                      cell?.value === '庄' || cell?.value === '红' ? styles.bankerCell : 
                      cell?.value === '闲' || cell?.value === '蓝' ? styles.playerCell : 
                      cell?.value === '和' ? styles.tieCell : null
                    ]}
                  >
                    {cell && (
                      <Text style={[styles.cellText, { fontSize: cellSize * 0.5 }]}>
                        {cell.value.charAt(0)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderGrid(roadsData.roads['珠盘路'], 30)}
      {renderGrid(roadsData.roads['大路'], 24)}
      <View style={styles.smallRoadsContainer}>
        <View style={styles.halfWidth}>{renderGrid(roadsData.roads['大眼仔路'], 16)}</View>
        <View style={styles.halfWidth}>
          {renderGrid(roadsData.roads['小路'], 16)}
          {renderGrid(roadsData.roads['螳螂路'], 16)}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#8b949e',
    fontSize: 16,
  },
  roadSection: {
    marginBottom: 16,
  },
  roadTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  grid: {
    borderWidth: 1,
    borderColor: '#30363d',
    backgroundColor: '#0d1117',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 0.5,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankerCell: {
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
  },
  playerCell: {
    backgroundColor: 'rgba(24, 144, 255, 0.1)',
  },
  tieCell: {
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
  },
  cellText: {
    fontWeight: 'bold',
    color: '#c9d1d9',
  },
  smallRoadsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  }
});

export default FiveRoadsChart;
