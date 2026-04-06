#!/usr/bin/env python3
"""
第十轮: 五路走势图规则和布局完善 — 专项验证测试
====================================================

本脚本验证以下修复:
1. [P0] 派生路每列最多6行限制（之前缺少此检查）
2. [P1] 珠盘路固定14×6网格
3. [P2] 类常量化 (MAX_ROWS_PER_COLUMN / BEAD_COLUMNS / BEAD_MAX_ROWS)
4. [P3] 大路6行限制边界行为

特别关注:
- 连续相同"延"值时派生路是否正确折列
- 超过6行后坐标是否正确(row=5, column+1)
"""

import sys
sys.path.insert(0, '.')

from backend.app.services.road_engine import UnifiedRoadEngine


def test_p0_derived_road_6_row_limit():
    """
    P0关键测试：派生路6行限制
    
    构造一个场景，使大眼仔路产生大量连续相同的"延"值，
    验证当一行超过6个点时是否正确折到新列的最后一行。
    
    输入模式设计:
      需要一个序列使得大眼仔路连续产生7+个相同值(全延)
      
      思路: 使用长龙+特定模式让情形B持续返回"有值"(延)
            大路: 庄庄庄庄庄庄 | 闲闲闲闲闲闲 | 庄庄庄庄庄庄 | 闲...
                  (col0=6庄)   (col1=5闲)     (col2=6庄)
            
      对于大眼仔(k=1):
        col1(m=1): 情形A - 比较col0高(6) vs col不存在 → fallback蓝(转) ✗ 不行
      
    换一个思路: 直接用大量交替数据产生连续"延"
    """
    print("\n" + "#" * 70)
    print("# P0测试: 派生路6行限制")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    
    # 设计一个能触发大量连续"延"的序列
    # 关键: 情形B中，当左移k格+上移1格有值时→延
    # 如果我们构造一个大路，使得每次延续时同行都有值...
    
    # 最直接的方法: 用一个非常长的序列(50+局)
    # 统计上大概率会出现连续6+个相同派生值的场景
    results = []
    for i in range(40):  # 40局足够触发各种情况
        if i % 3 == 0:
            results.append("庄")
        elif i % 3 == 1:
            results.append("庄")
        else:
            results.append("闲")
    
    for i, r in enumerate(results, 1):
        engine.process_game(i, r)
    
    five_roads = engine.calculate_all_roads()
    
    # 检查所有派生路的行数都不超过6
    all_ok = True
    for name, road in [
        ("大眼仔路", five_roads.big_eye_boy),
        ("小路", five_roads.small_road),
        ("螳螂路", five_roads.cockroach_road),
    ]:
        if not road.points:
            continue
            
        max_row = max(p.row for p in road.points)
        
        if max_row >= engine.MAX_ROWS_PER_COLUMN:
            print(f"\n  ⚠️ {name}: max_row={max_row} >= {engine.MAX_ROWS_PER_COLUMN}")
            # 检查是否有任何点的row > MAX_ROWS_PER_COLUMN-1
            bad_points = [p for p in road.points if p.row >= engine.MAX_ROWS_PER_COLUMN]
            if bad_points:
                print(f"    ❌ 发现{len(bad_points)}个超限点! row范围超出了{engine.MAX_ROWS_PER_COLUMN}限制!")
                for bp in bad_points[:5]:
                    print(f"       列{bp.column}行{bp.row}: {bp.value} (局{bp.game_number})")
                all_ok = False
            else:
                print(f"    ✅ max_row={max_row}, 但所有点都在允许范围内(折列逻辑正常)")
        else:
            print(f"  ✅ {name}: max_row={max_row} < {engine.MAX_ROWS_PER_COLUMN} (符合限制)")
    
    assert all_ok, "存在超出6行限制的点!"
    print("\n  ✅ 派生路6行限制验证通过!")


def test_big_road_exact_6_then_fold():
    """
    测试大路精确6个后的折列行为
    
    输入: 8连庄
    预期: 
      col0: row0~5 (6个庄)
      col1: row5 (第7个庄折到这里)
      col2: row5 (第8个庄继续折)
    """
    print("\n" + "#" * 70)
    print("# 测试: 大路精确6+折列行为 (8连庄)")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    for i in range(1, 9):
        engine.process_game(i, "庄")
    
    br = engine.calculate_all_roads().big_road
    
    print(f"\n  大路: {len(br.points)}个点, {br.max_columns}列×{br.max_rows}行")
    
    # 验证前6个在col0, 第7个在col1.row5, 第8个在col2.row5
    points_by_col = {}
    for p in br.points:
        if p.column not in points_by_col:
            points_by_col[p.column] = []
        points_by_col[p.column].append(p)
    
    assert 0 in points_by_col and len(points_by_col[0]) == 6, f"col0应有6个点，实际{len(points_by_col.get(0, []))}"
    assert 1 in points_by_col and len(points_by_col[1]) == 1, f"col1应有1个点(第7个)，实际{len(points_by_col.get(1, []))}"
    assert points_by_col[1][0].row == 5, "第7个点应在row5"
    assert 2 in points_by_col and len(points_by_col[2]) == 1, f"col2应有1个点(第8个)，实际{len(points_by_col.get(2, []))}"
    assert points_by_col[2][0].row == 5, "第8个点应在row5"
    
    print(f"  ✅ col0: 6个点(row 0-5)")
    print(f"  ✅ col1: 1个点(row 5) ← 第7个庄正确折列")
    print(f"  ✅ col2: 1个点(row 5) ← 第8个庄正确折列")
    print("\n  ✅ 大路折列行为完全正确!")


def test_bead_road_fixed_grid():
    """
    测试珠盘路固定14×6网格
    
    输入: 100个有效结果（超过84=14×6的限制）
    预期:
      - column范围: 0-13 (固定14列)
      - row范围: 0-5 (固定6行)
      - 超过84个的点会覆盖前面的位置
    """
    print("\n" + "#" * 70)
    print("# 测试: 珠盘路固定网格 (100个结果 > 84上限)")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    for i in range(1, 101):
        engine.process_game(i, "庄" if i % 2 else "闲")
    
    bead = engine.calculate_all_roads().bead_road
    
    print(f"\n  珠盘路: {len(bead.points)}个输入点")
    print(f"  声明尺寸: {bead.max_columns}列 × {bead.max_rows}行")
    
    max_col = max(p.column for p in bead.points)
    max_row = max(p.row for p in bead.points)
    
    print(f"  实际最大列: {max_col} (应<={engine.BEAD_COLUMNS})")
    print(f"  实际最大行: {max_row} (应<={engine.BEAD_MAX_ROWS})")
    
    assert max_col < engine.BEAD_COLUMNS, f"column超限: {max_col}>={engine.BEAD_COLUMNS}"
    assert max_row < engine.BEAD_MAX_ROWS, f"row超限: {max_row}>={engine.BEAD_MAX_ROWS}"
    
    # 检查覆盖: 第85个点和第1个点应该在同一位置
    if len(bead.points) > 84:
        first_point = bead.points[0]
        point_85 = bead.points[84]  # idx=84是第85个点
        print(f"\n  第1点: 列{first_point.column}行{first_point.row}")
        print(f"  第85点: 列{point_85.column}行{point_85.row}")
        assert point_85.column == first_point.column and point_85.row == first_point.row, \
            "第85个点应该覆盖第1个点!"
        print(f"  ✅ 循环覆盖行为正确 (第85点回到起点)")
    
    print("\n  ✅ 珠盘路固定网格验证通过!")


def test_constants_values():
    """验证类常量值是否正确"""
    print("\n" + "#" * 70)
    print("# 测试: 类常量定义验证")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    
    print(f"\n  MAX_ROWS_PER_COLUMN = {engine.MAX_ROWS_PER_COLUMN} (预期: 6)")
    print(f"  BEAD_COLUMNS = {engine.BEAD_COLUMNS} (预期: 14)")
    print(f"  BEAD_MAX_ROWS = {engine.BEAD_MAX_ROWS} (预期: 6)")
    
    assert engine.MAX_ROWS_PER_COLUMN == 6
    assert engine.BEAD_COLUMNS == 14
    assert engine.BEAD_MAX_ROWS == 6
    
    print("\n  ✅ 所有常量值正确!")


def test_extreme_long_streak_derived():
    """
    极端测试: 20连庄后接20连闲
    
    这会产生大量同色结果，测试：
    1. 大路的6行限制多次触发
    2. 派生路的6行限制也正确工作
    """
    print("\n" + "#" * 70)
    print("# 极端测试: 20连庄+20连闲")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    
    # 20连庄
    for i in range(1, 21):
        engine.process_game(i, "庄")
    
    # 20连闲
    for i in range(21, 41):
        engine.process_game(i, "闲")
    
    result = engine.calculate_all_roads()
    
    br = result.big_road
    beb = result.big_eye_boy
    
    print(f"\n  大路: {len(br.points)}点, {br.max_columns}列×{br.max_rows}行")
    print(f"  大眼仔: {len(beb.points)}点, {beb.max_columns}列×{beb.max_rows}行")
    
    # 验证大路行数不超过6
    assert br.max_rows <= 6, f"大路行数超限: {br.max_rows}"
    
    # 验证派生路行数不超过6
    all_roads = [
        ("大眼仔路", result.big_eye_boy),
        ("小路", result.small_road),
        ("螳螂路", result.cockroach_road),
    ]
    for name, road in all_roads:
        if road.points:
            max_r = max(p.row for p in road.points)
            assert max_r < 6, f"{name}行数超限: max_row={max_r}"
    
    print("\n  ✅ 极端场景下所有限制均正确!")


def run_all():
    """运行所有第十轮专项测试"""
    print("=" * 70)
    print("  第十轮: 五路规则和布局完善 — 专项验证")
    print("  [P0]派生路6行限制 · [P1]珠盘路固定网格 · [P2]常量化")
    print("=" * 70)
    
    tests = [
        ("类常量值验证", test_constants_values),
        ("大路精确6+折列", test_big_road_exact_6_then_fold),
        ("P0:派生路6行限制", test_p0_derived_road_6_row_limit),
        ("P1:珠盘路固定网格", test_bead_road_fixed_grid),
        ("极端长连场景", test_extreme_long_streak_derived),
    ]
    
    passed = failed = 0
    for name, func in tests:
        try:
            func()
            passed += 1
        except Exception as e:
            print(f"\n  ❌ {name} 失败: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 70)
    print(f"  结果: {passed}通过, {failed}失败, 共{len(tests)}项")
    print("=" * 70)
    return failed == 0


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
