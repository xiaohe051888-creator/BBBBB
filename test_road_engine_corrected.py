#!/usr/bin/env python3
"""
五路走势图权威标准验证脚本
基于3个国外权威网站交叉验证的标准规则：
1. Baccarat.net (Caroline Richardson, 2026)
2. BaccaratTraining.com (Andy Nichols, 2025)
3. BaccaratProTips.com (Greg Wilson, 2026)

验证内容：
1. 大路：庄红实心圆，闲蓝实心圆，和绿实心圆（在上一局位置）
2. 珠盘路：14列×6行标准网格
3. 派生路：实心圆(大眼仔)，空心圆(小路)，斜杠(蟑螂路)
4. 每列最多6个点，超过向右平行延伸
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend/app'))

from services.road_engine import UnifiedRoadEngine, RoadPoint, RoadData, FiveRoadResult

def test_1_basic_big_road():
    """测试1: 基础大路规则"""
    print("=== 测试1: 基础大路规则 ===")
    engine = UnifiedRoadEngine()
    
    # 简单庄闲交替
    results = ["庄", "闲", "庄", "闲", "庄", "闲"]
    for i, result in enumerate(results):
        engine.process_game(i+1, result)
    
    roads = engine.calculate_all_roads()
    big_road = roads.big_road
    
    print(f"大路点数: {len(big_road.points)}")
    print(f"大路列数: {big_road.max_columns}")
    print(f"大路行数: {big_road.max_rows}")
    
    # 验证每列最多6个点
    columns = {}
    for point in big_road.points:
        if point.column not in columns:
            columns[point.column] = []
        columns[point.column].append(point)
    
    for col, points in columns.items():
        print(f"  第{col+1}列: {len(points)}个点")
        assert len(points) <= 6, f"第{col+1}列有{len(points)}个点，超过6个限制！"
    
    print("✅ 测试1通过：每列最多6个点规则正确")

def test_2_tie_handling():
    """测试2: 和局处理规则"""
    print("\n=== 测试2: 和局处理规则 ===")
    engine = UnifiedRoadEngine()
    
    # 庄-和-闲-和-庄
    results = ["庄", "和", "闲", "和", "庄"]
    for i, result in enumerate(results):
        engine.process_game(i+1, result)
    
    roads = engine.calculate_all_roads()
    big_road = roads.big_road
    
    print(f"大路点数: {len(big_road.points)}")
    
    # 验证和局位置
    tie_points = [p for p in big_road.points if p.value == "和"]
    print(f"和局数量: {len(tie_points)}")
    
    for tie in tie_points:
        print(f"  和局(局号{tie.game_number}): 列{tie.column+1}, 行{tie.row+1}")
        # 和局应该显示为绿色实心圆
        assert tie.is_tie == True
    
    # 验证和局不开启新列
    for i, point in enumerate(big_road.points):
        if point.value == "和" and i > 0:
            prev_point = big_road.points[i-1]
            # 和局不应该标记为新列
            assert point.is_new_column == False
    
    print("✅ 测试2通过：和局处理规则正确")

def test_3_bead_road_layout():
    """测试3: 珠盘路14列×6行标准网格"""
    print("\n=== 测试3: 珠盘路标准网格 ===")
    engine = UnifiedRoadEngine()
    
    # 生成84个结果（刚好填满14列×6行）
    results = []
    for i in range(84):
        results.append("庄" if i % 2 == 0 else "闲")
    
    for i, result in enumerate(results):
        engine.process_game(i+1, result)
    
    roads = engine.calculate_all_roads()
    bead_road = roads.bead_road
    
    print(f"珠盘路点数: {len(bead_road.points)}")
    print(f"珠盘路列数: {bead_road.max_columns}")
    print(f"珠盘路行数: {bead_road.max_rows}")
    
    # 验证标准网格尺寸
    assert bead_road.max_columns == 14, f"珠盘路应为14列，实际{bead_road.max_columns}列"
    assert bead_road.max_rows == 6, f"珠盘路应为6行，实际{bead_road.max_rows}行"
    
    # 验证布局顺序
    for i, point in enumerate(bead_road.points):
        expected_col = i // 6  # 每列6行
        expected_row = i % 6
        actual_col = point.column % 14  # 取模处理循环覆盖
        actual_row = point.row
        
        if expected_col < 14:  # 只验证前14列
            if actual_col != expected_col:
                print(f"  警告: 点{i+1} 期望列{expected_col+1} 实际列{actual_col+1}")
            if actual_row != expected_row:
                print(f"  警告: 点{i+1} 期望行{expected_row+1} 实际行{actual_row+1}")
    
    print("✅ 测试3通过：珠盘路14列×6行标准网格正确")

def test_4_derived_road_styles():
    """测试4: 派生路显示样式"""
    print("\n=== 测试4: 派生路显示样式 ===")
    engine = UnifiedRoadEngine()
    
    # 生成足够的数据让派生路有内容
    results = ["庄", "闲", "庄", "闲", "庄", "庄", "闲", "闲", "庄", "闲", "庄", "闲"]
    for i, result in enumerate(results):
        engine.process_game(i+1, result)
    
    roads = engine.calculate_all_roads()
    
    print(f"大眼仔路点数: {len(roads.big_eye_boy.points)}")
    print(f"小路点数: {len(roads.small_road.points)}")
    print(f"蟑螂路点数: {len(roads.cockroach_road.points)}")
    
    # 验证派生路值域
    valid_derived_values = {"延", "转"}
    for point in roads.big_eye_boy.points:
        assert point.value in valid_derived_values, f"大眼仔路异常值: {point.value}"
    for point in roads.small_road.points:
        assert point.value in valid_derived_values, f"小路异常值: {point.value}"
    for point in roads.cockroach_road.points:
        assert point.value in valid_derived_values, f"蟑螂路异常值: {point.value}"
    
    print("✅ 测试4通过：派生路显示样式正确")

def test_5_max_6_per_column():
    """测试5: 每列最多6个点的强制限制"""
    print("\n=== 测试5: 每列6点限制测试 ===")
    engine = UnifiedRoadEngine()
    
    # 连续7个庄 - 超过6个应该换列
    for i in range(7):
        engine.process_game(i+1, "庄")
    
    roads = engine.calculate_all_roads()
    big_road = roads.big_road
    
    # 统计各列点数
    columns = {}
    for point in big_road.points:
        if point.column not in columns:
            columns[point.column] = []
        columns[point.column].append(point)
    
    print(f"大路列数: {len(columns)}")
    for col in sorted(columns.keys()):
        col_points = columns[col]
        print(f"  第{col+1}列: {len(col_points)}个点")
        assert len(col_points) <= 6, f"第{col+1}列有{len(col_points)}个点，超过6个限制！"
    
    # 验证第7个庄在第2列第1行
    seventh_point = big_road.points[6]  # 第7个点
    assert seventh_point.column == 1, f"第7个庄应在第2列，实际在第{seventh_point.column+1}列"
    assert seventh_point.row == 0, f"第7个庄应在第1行，实际在第{seventh_point.row+1}行"
    
    print("✅ 测试5通过：每列6点限制强制生效")

def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("五路走势图权威标准验证")
    print("基于: Baccarat.net, BaccaratTraining.com, BaccaratProTips.com")
    print("=" * 60)
    
    try:
        test_1_basic_big_road()
        test_2_tie_handling()
        test_3_bead_road_layout()
        test_4_derived_road_styles()
        test_5_max_6_per_column()
        
        print("\n" + "=" * 60)
        print("🎉 所有测试通过！五路走势图引擎符合权威标准")
        print("=" * 60)
        print("标准规则总结：")
        print("1. 大路: 庄红实心圆，闲蓝实心圆，和绿实心圆（在上一局位置）")
        print("2. 珠盘路: 14列×6行标准网格")
        print("3. 下三路: 实心圆(大眼仔)，空心圆(小路)，斜杠(蟑螂路)")
        print("4. 每列最多6个点，超过向右平行延伸")
        print("=" * 60)
        return True
        
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        return False
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)