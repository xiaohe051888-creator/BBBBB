import re

with open('/workspace/mobile/src/components/roads/FiveRoadsChart.tsx', 'r') as f:
    content = f.read()

# Fix BigRoad logic
new_big_road = """const BigRoad = ({ data, cols }: { data: string[]; cols: number }) => {
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
};"""

content = re.sub(r'const BigRoad =.*?</Canvas>\n  );\n};', new_big_road, content, flags=re.DOTALL)

with open('/workspace/mobile/src/components/roads/FiveRoadsChart.tsx', 'w') as f:
    f.write(content)
