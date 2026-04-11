#!/usr/bin/env python3
"""
长龙拐弯测试 V2 - 根据用户提供的正确显示验证

用户确认的正确显示：
第一列
第1个格子 红色   第1局
第2个格子 红色   第2局
第3个格子 红色   第3局
第4个格子 红色   第4局
第5个格子 红色   第5局
第6个格子 红色   第6局

第二列
第1个格子 蓝色   第9局
第2个格子 蓝色   第10局
第3个格子 蓝色   第11局
第4个格子 蓝色   第12局
第5个格子 蓝色   第13局
第6个格子 红色   第7局

第三列
第1个格子 红色   第15局
第2个格子 红色   第16局
第3个格子 红色   第17局
第4个格子 空
第5个格子 蓝色   第14局
第6个格子 红色   第8局
"""

import sys
sys.path.insert(0, '/Users/ww/WorkBuddy/20260405164649/BBBBB/backend')

from app.services.road_engine import RoadEngine

# 测试数据
entries = [
    (1, "庄"), (2, "庄"), (3, "庄"), (4, "庄"),
    (5, "庄"), (6, "庄"), (7, "庄"), (8, "庄"),
    (9, "闲"), (10, "闲"), (11, "闲"), (12, "闲"),
    (13, "闲"), (14, "闲"), (15, "庄"), (16, "庄"), (17, "庄")
]

print("=" * 60)
print("测试数据：")
print("  第1-8局: 庄")
print("  第9-14局: 闲")
print("  第15-17局: 庄")
print("=" * 60)

engine = RoadEngine()
roads = engine.calculate_all_roads(entries)
big_road = roads["big_road"]

print("\n大路结果：")
print("-" * 60)

# 按列分组
columns = {}
for p in big_road.points:
    if p.column not in columns:
        columns[p.column] = []
    columns[p.column].append(p)

# 按行排序每列的点
for col in sorted(columns.keys()):
    points = sorted(columns[col], key=lambda p: p.row)
    print(f"\n第{col+1}列:")
    for i, p in enumerate(points):
        color = "红色" if p.value == "庄" else "蓝色"
        print(f"  第{i+1}个格子 {color}   第{p.game_number}局  (行{p.row})")

print("\n" + "=" * 60)
print("网格可视化（6行 x N列）：")
print("-" * 60)

# 创建网格
max_col = max(p.column for p in big_road.points) if big_road.points else 0
grid = [["   " for _ in range(max_col + 1)] for _ in range(6)]

for p in big_road.points:
    if p.value == "庄":
        grid[p.row][p.column] = f"R{p.game_number:02d}"
    else:
        grid[p.row][p.column] = f"B{p.game_number:02d}"

print("     " + "  ".join(f"C{c:02d}" for c in range(max_col + 1)))
for r in range(6):
    print(f"R{r}:  " + " ".join(grid[r]))

print("\n" + "=" * 60)
print("验证期望：")
print("-" * 60)
print("第一列: 庄1-6 (行0-5)")
print("第二列: 闲9-13 (行0-4), 庄7 (行5)")
print("第三列: 庄15-17 (行0-2), 闲14 (行4), 庄8 (行5)")

print("\n" + "=" * 60)
print("位置验证：")
print("-" * 60)

# 验证函数
def check_point(col, row, expected_game, expected_value):
    for p in big_road.points:
        if p.column == col and p.row == row:
            if p.game_number == expected_game and p.value == expected_value:
                print(f"✓ 第{col+1}列第{row+1}行: {p.value}{p.game_number}局 - 正确")
                return True
            else:
                print(f"✗ 第{col+1}列第{row+1}行: {p.value}{p.game_number}局 - 期望 {expected_value}{expected_game}局")
                return False
    print(f"✗ 第{col+1}列第{row+1}行: 空 - 期望 {expected_value}{expected_game}局")
    return False

all_pass = True
all_pass &= check_point(0, 0, 1, "庄")
all_pass &= check_point(0, 5, 6, "庄")
all_pass &= check_point(1, 0, 9, "闲")
all_pass &= check_point(1, 4, 13, "闲")
all_pass &= check_point(1, 5, 7, "庄")
all_pass &= check_point(2, 5, 8, "庄")

print("\n" + "=" * 60)
if all_pass:
    print("✓ 所有验证通过！")
else:
    print("✗ 验证失败，需要进一步修复。")
print("=" * 60)
