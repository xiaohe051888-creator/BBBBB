#!/usr/bin/env python3
"""
测试大路显示格式
8个庄 + 2个闲
"""
import sys
sys.path.insert(0, '/Users/ww/WorkBuddy/20260405164649/BBBBB/backend')

from app.services.road_engine import UnifiedRoadEngine

def test_display():
    engine = UnifiedRoadEngine()
    
    # 8个庄 + 2个闲
    results = ["庄"] * 8 + ["闲"] * 2
    
    for i, result in enumerate(results, 1):
        engine.process_game(i, result)
    
    five_roads = engine.calculate_all_roads()
    big_road = five_roads.big_road
    
    print("=== 当前显示 ===")
    grid = {}
    for p in big_road.points:
        if p.column not in grid:
            grid[p.column] = {}
        grid[p.column][p.row] = "1" if p.value == "庄" else "2"
    
    for row in range(6):
        line = ""
        for col in range(big_road.max_columns):
            if col in grid and row in grid[col]:
                line += grid[col][row]
            else:
                line += " "
        print(f"行{row}: '{line}'")
    
    print("\n各点位置:")
    for p in big_road.points:
        print(f"  局{p.game_number}: {p.value} -> 列{p.column}, 行{p.row}")

if __name__ == "__main__":
    test_display()
