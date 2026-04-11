#!/usr/bin/env python3
"""
测试长龙拐弯规则 - 用户提供的示例

场景：
- 第1-8局：庄（红色）
- 第9-14局：闲（蓝色）
- 第15-17局：庄（红色）

期望显示：
第一列：庄1-6（行0-5）
第二列：闲9-13（行0-4，因为行5被庄7占用），庄7（行5），庄8（拐弯到第三列行5）
第三列：庄15（行5，被占用所以从行5开始），庄16（拐弯），闲14（拐弯）
"""

import sys
sys.path.insert(0, '/Users/ww/WorkBuddy/20260405164649/BBBBB/backend')

from app.services.road_engine import RoadEngine

def test_long_dragon():
    # 构建测试数据
    entries = []
    # 第1-8局：庄
    for i in range(1, 9):
        entries.append((i, "庄"))
    # 第9-14局：闲
    for i in range(9, 15):
        entries.append((i, "闲"))
    # 第15-17局：庄
    for i in range(15, 18):
        entries.append((i, "庄"))
    
    print("=" * 60)
    print("测试数据：")
    print(f"  第1-8局: 庄")
    print(f"  第9-14局: 闲")
    print(f"  第15-17局: 庄")
    print("=" * 60)
    
    # 创建引擎并计算大路
    engine = RoadEngine()
    engine.error_map = {}
    big_road = engine._calculate_big_road(entries)
    
    print("\n大路结果：")
    print("-" * 60)
    
    # 按列分组显示
    from collections import defaultdict
    col_groups = defaultdict(list)
    for point in big_road.points:
        col_groups[point.column].append(point)
    
    for col in sorted(col_groups.keys()):
        points = sorted(col_groups[col], key=lambda p: p.row)
        print(f"\n第{col + 1}列:")
        for p in points:
            print(f"  {p.value:2s}  第{p.game_number:2d}局  (行{p.row})")
    
    print("\n" + "=" * 60)
    print("网格可视化（6行 x N列）：")
    print("-" * 60)
    
    # 创建网格可视化
    max_col = max(p.column for p in big_road.points) if big_road.points else 0
    grid = [["  " for _ in range(max_col + 1)] for _ in range(6)]
    
    for point in big_road.points:
        if point.value == "庄":
            grid[point.row][point.column] = f"R{point.game_number:02d}"
        else:
            grid[point.row][point.column] = f"B{point.game_number:02d}"
    
    # 打印网格（从上到下）
    print("     " + "  ".join(f"C{i:02d}" for i in range(max_col + 1)))
    for row in range(6):
        print(f"R{row}:  " + " ".join(grid[row]))
    
    print("\n" + "=" * 60)
    print("验证期望：")
    print("-" * 60)
    print("第一列: 庄1-6 (行0-5)")
    print("第二列: 闲9-13 (行0-4), 庄7 (行5)")
    print("第三列: 庄8 (行5), 闲14 (行4), 庄15-17 (行5, 拐弯)")
    
    # 验证具体位置
    print("\n" + "=" * 60)
    print("位置验证：")
    print("-" * 60)
    
    # 构建位置查找表
    pos_map = {(p.column, p.row): p for p in big_road.points}
    
    checks = [
        # (列, 行, 期望局号, 期望结果)
        (0, 0, 1, "庄"),
        (0, 5, 6, "庄"),
        (1, 0, 9, "闲"),
        (1, 4, 13, "闲"),
        (1, 5, 7, "庄"),  # 庄7在第2列第6行（行索引5）
        (2, 5, 8, "庄"),  # 庄8拐弯到第3列
    ]
    
    all_pass = True
    for col, row, expect_game, expect_val in checks:
        point = pos_map.get((col, row))
        if point:
            if point.game_number == expect_game and point.value == expect_val:
                print(f"✓ 第{col+1}列第{row+1}行: {point.value}{point.game_number}局 - 正确")
            else:
                print(f"✗ 第{col+1}列第{row+1}行: {point.value}{point.game_number}局 - 期望 {expect_val}{expect_game}局")
                all_pass = False
        else:
            print(f"✗ 第{col+1}列第{row+1}行: 空 - 期望 {expect_val}{expect_game}局")
            all_pass = False
    
    print("\n" + "=" * 60)
    if all_pass:
        print("✓ 所有验证通过！长龙拐弯规则正确。")
    else:
        print("✗ 验证失败，需要进一步修复。")
    print("=" * 60)

if __name__ == "__main__":
    test_long_dragon()
