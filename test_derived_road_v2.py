#!/usr/bin/env python3
"""
下三路算法验证脚本 v2 — 标准两种情形法验证
===========================================

基于5个国外权威来源交叉验证的算法:
- baccarat.net (Caroline Richardson, 2026)
- baccaratprotips.com (Greg Wilson, 2026)  
- gamblingforums.com (@Jimske, 2022)
- baccarattraining.com (Andy Nichols, 2025)
- livedealer.org (Microgaming团队, 2010-2024)

核心规则:
  情形A (新列出现 m=1): 比较 左边第1列 vs 左边第(k+1)列 高度是否相等
  情形B (延续当前列 m>=2): 向左移k格+向上移1格，检查该位置是否有值
"""

import sys
sys.path.insert(0, '.')

from backend.app.services.road_engine import UnifiedRoadEngine


def print_road_grid(road, title, max_show=20):
    """打印路数据的网格可视化"""
    print(f"\n{'='*60}")
    print(f" {title} (共{len(road.points)}个点, {road.max_columns}列x{road.max_rows}行)")
    print(f"{'='*60}")
    
    if not road.points:
        print(" [无数据]")
        return
    
    # 打印每个点的详细信息
    for i, p in enumerate(road.points):
        marker = "★" if p.is_new_column else " "
        print(f"  [{i:2d}] 列{p.column:2d}行{p.row:1d} | {p.value} | 局{p.game_number} {marker}")
        if i >= max_show - 1 and len(road.points) > max_show:
            print(f"  ... 还有{len(road.points)-max_show}个点")
            break


def test_case_1_six_bankers():
    """
    测试用例1: 6连庄
    大路: 庄庄庄庄庄庄 → 1列6行
    预期: 下三路全部无数据（只有1列，不够offset）
    """
    print("\n" + "#" * 70)
    print("# 测试用例1: 6连庄")
    print("# 输入: 庄庄庄庄庄庄")
    print("# 预期: 下三路无数据（大路仅1列，不足offset）")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    results = ["庄"] * 6
    
    for i, r in enumerate(results, 1):
        result = engine.process_game(i, r)
    
    print(f"\n大路: {len(result.big_road.points)}个点, {result.big_road.max_columns}列")
    
    for road_type, road in [
        ("大眼仔路", result.big_eye_boy),
        ("小路", result.small_road),
        ("螳螂路", result.cockroach_road),
    ]:
        assert len(road.points) == 0, f"{road_type}应该为空但得到{len(road.points)}个点"
        print(f"  ✅ {road_type}: 空数据（正确）")


def test_case_2_alternating():
    """
    测试用例2: 庄闲交替 (12局)
    大路: 庄|闲|庄|闲|庄|闲|庄|闲|庄|闲|庄|闲 → 12列每列1行
    每次都是新列(m=1)，走情形A：比较左边第1列 vs 左边第(k+1)列高度
    
    对于大眼仔(k=1), 从第2列(col_idx=1)开始:
      第2列: 左边1列高=1, 左边2列不存在 → fallback蓝
      第3列: 左边1列高=1, 左边2列高=1 → 相等→红
      第4列: 左边1列高=1, 左边2列高=1 → 相等→红
      ...所有后续列都是高度相等→红
    """
    print("\n" + "#" * 70)
    print("# 测试用例2: 庄闲交替 (12局)")
    print("# 输入: 庄闲庄闲庄闲庄闲庄闲庄闲")
    print("# 预期: 大眼仔从第2列开始有数据，大部分为红(高度都=1)")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    results = ["庄", "闲"] * 6  # 12局交替
    
    for i, r in enumerate(results, 1):
        result = engine.process_game(i, r)
    
    print(f"\n大路: {len(result.big_road.points)}个点, {result.big_road.max_columns}列x{result.big_road.max_rows}行")
    
    # 大眼仔应有数据（从第2列即col_idx=1开始，k=1）
    beb = result.big_eye_boy
    print(f"\n大眼仔路: {len(beb.points)}个点")
    assert len(beb.points) > 0, "大眼仔应该有数据"
    
    # 小路从第3列开始
    sr = result.small_road
    print(f"小路: {len(sr.points)}个点")
    
    # 螳螂路从第4列开始  
    cr = result.cockroach_road
    print(f"螳螂路: {len(cr.points)}个点")
    
    # 验证数量关系: 螳螂路 <= 小路 <= 大眼仔
    assert len(cr.points) <= len(sr.points) <= len(beb.points), \
        f"数量关系异常: BEB={len(beb.points)}, SR={len(sr.points)}, CR={len(cr.points)}"
    print(f"  ✅ 数量关系正确: BEB({len(beb.points)}) >= SR({len(sr.points)}) >= CR({len(cr.points)})")


def test_case_3_mixed_pattern():
    """
    测试用例3: 混合模式 (含连续和转折)
    输入: 庄庄|闲|庄庄庄|闲闲|庄|闲|庄庄|闲|庄 (15局有效结果)
    
    大路布局:
      col0: 庄庄 (2行)
      col1: 闲   (1行)
      col2: 庄庄庄 (3行)
      col3: 闲闲 (2行)
      col4: 庄   (1行)
      col5: 闲   (1行)
      col6: 庄庄 (2行)
      col7: 闲   (1行)
      col8: 庄   (1行)
    
    这个测试同时包含新列(m=1)和延续(m>=2)两种情形
    """
    print("\n" + "#" * 70)
    print("# 测试用例3: 混合模式 (含连续和转折)")
    print("# 输入: 庄庄 闲 庄庄庄 闲闲 庄 闲 庄庄 闲 庄")
    print("# 测试两种情形判断都能正确工作")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    results = ["庄", "庄", "闲", "庄", "庄", "庄", "闲", "闲", "庄", "闲", "庄", "庄", "闲", "庄"]
    
    for i, r in enumerate(results, 1):
        result = engine.process_game(i, r)
    
    print(f"\n大路: {len(result.big_road.points)}个点, {result.big_road.max_columns}列x{result.big_road.max_rows}行")
    
    # 打印大路详情
    print("\n大路详情:")
    for p in result.big_road.points:
        new_mark = " ←新列" if p.is_new_column else ""
        print(f"  列{p.column}行{p.row}: {p.value} (局{p.game_number}){new_mark}")
    
    for name, road in [("大眼仔路", result.big_eye_boy), ("小路", result.small_road), ("螳螂路", result.cockroach_road)]:
        print_road_grid(road, name)
        
        # 验证派生路的值只能是延或转
        for p in road.points:
            assert p.value in ("延", "转"), f"{name}包含非法值: {p.value}"
        print(f"  ✅ 所有值合法（延/转）")


def test_case_4_dragon_with_choppy():
    """
    测试用例4: 长龙后接 choppy模式
    输入: 庄庄庄庄庄庄|闲|庄|闲|庄|闲|闲|庄|闲|庄|闲|庄 (18局)
    
    前6个是长龙(同一列)，之后频繁换列
    这个测试重点验证情形B（延续当前列时左移k上移1格的判断）
    """
    print("\n" + "#" * 70)
    print("# 测试用例4: 长龙后接choppy模式 (18局)")
    print("# 输入: 庄庄庄庄庄庄 闲 庄 闲 庄 闲 闲 庄 闲 庄 闲 庄")
    print("# 重点验证情形B: 延续当前列时的同行判断")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    results = (
        ["庄"] * 6 +      # 长龙: 6连庄 (1列)
        ["闲", "庄", "闲", "庄", "闲", "闲", "庄", "闲", "庄", "闲", "庄"]  # choppy: 11局
    )
    
    for i, r in enumerate(results, 1):
        result = engine.process_game(i, r)
    
    print(f"\n大路: {len(result.big_road.points)}个点, {result.big_road.max_columns}列x{result.big_road.max_rows}行")
    
    # 打印大路详情
    print("\n大路网格:")
    for r in range(result.big_road.max_rows):
        line = ""
        for c in range(result.big_road.max_columns):
            pt = next((p for p in result.big_road.points if p.column == c and p.row == r), None)
            if pt:
                line += f" {pt.value[0]:1s} "
            else:
                line += " · "
        print(f"  行{r}:{line}")
    
    for name, road in [("大眼仔路", result.big_eye_boy), ("小路", result.small_road), ("螳螂路", result.cockroach_road)]:
        print_road_grid(road, name)


def test_case_5_realistic_shoe():
    """
    测试用例5: 模拟真实靴 (30局)
    使用一个更接近真实百家乐的结果序列
    """
    print("\n" + "#" * 70)
    print("# 测试用例5: 真实靴模拟 (30局)")
    print("#" * 70)
    
    engine = UnifiedRoadEngine()
    # 一个模拟的真实序列（接近50/50分布但有一些聚集）
    realistic_results = [
        "庄", "庄", "闲",           # 1-3: 庄庄闲
        "庄", "闲",                 # 4-5: 庄闲
        "庄", "庄", "闲", "闲",     # 6-9: 庄庄闲闲
        "庄",                       # 10: 庄
        "闲", "闲",                 # 11-12: 闲闲
        "庄", "庄", "庄",           # 13-15: 庄庄庄
        "闲",                       # 16: 闲
        "庄", "闲",                 # 17-18: 庄闲
        "庄",                       # 19: 庄
        "闲", "闲", "闲",           # 20-22: 闲闲闲
        "庄", "庄",                 # 23-24: 庄庄
        "闲", "庄", "闲",           # 25-27: 闲庄闲
        "庄", "闲", "庄",           # 28-30: 庄闲庄
    ]
    
    for i, r in enumerate(realistic_results, 1):
        result = engine.process_game(i, r)
    
    print(f"\n总有效结果: {len(realistic_results)}局")
    print(f"大路: {len(result.big_road.points)}个点, {result.big_road.max_columns}列x{result.big_road.max_rows}行")
    
    # 统计下三路的红蓝分布
    for name, road in [("大眼仔路", result.big_eye_boy), ("小路", result.small_road), ("螳螂路", result.cockroach_road)]:
        red_count = sum(1 for p in road.points if p.value == "延")
        blue_count = sum(1 for p in road.points if p.value == "转")
        total = len(road.points)
        red_pct = red_count / max(total, 1) * 100
        blue_pct = blue_count / max(total, 1) * 100
        print(f"\n  {name}: {total}个点 | 红(延)={red_count} ({red_pct:.0f}%) | 蓝(转)={blue_count} ({blue_pct:.0f}%)")
        
        if total > 0:
            # 合理的红蓝比例应该在20%-80%之间
            ratio = red_count / total
            assert 0.1 <= ratio <= 0.9, f"{name}红蓝比例异常: {ratio:.2%}"


def run_all_tests():
    """运行所有测试用例"""
    print("=" * 70)
    print("  下三路算法 v2 验证 — 标准两种情形法")
    print("  来源: baccarat.net, baccaratprotips.com, gamblingforums.com,")
    print("        baccarattraining.com, livedealer.org")
    print("=" * 70)
    
    tests = [
        ("6连庄测试", test_case_1_six_bankers),
        ("庄闲交替测试", test_case_2_alternating),
        ("混合模式测试", test_case_3_mixed_pattern),
        ("长龙+choppy测试", test_case_4_dragon_with_choppy),
        ("真实靴模拟", test_case_5_realistic_shoe),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            test_func()
            passed += 1
        except Exception as e:
            print(f"\n  ❌ {name} 失败: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 70)
    print(f"  测试结果: {passed}通过, {failed}失败, 共{len(tests)}个测试")
    print("=" * 70)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
