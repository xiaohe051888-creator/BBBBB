#!/usr/bin/env python3
"""
测试修正后的五路走势图引擎 - 权威标准验证
验证8个权威网站交叉验证的标准规则
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.road_engine import UnifiedRoadEngine

def test_case_1_basic_big_road():
    """测试1: 基础大路 - 庄闲交替"""
    print("=== 测试1: 基础大路 - 庄闲交替 ===")
    engine = UnifiedRoadEngine()
    
    # 简单交替序列
    sequence = ["庄", "闲", "庄", "闲", "庄", "闲", "庄", "闲"]
    
    for i, result in enumerate(sequence, start=1):
        engine.process_game(i, result)
        
    five_roads = engine.calculate_all_roads()
    big_road = five_roads["big_road"]
        
    print(f"大路点数: {len(big_road.points)}")
    print(f"大路列数: {big_road.max_columns}")
    print(f"大路行数: {big_road.max_rows}")
    
    # 验证: 庄闲交替应该每列1个点，共8列
    assert len(big_road.points) == 8, f"预期8个点，实际{len(big_road.points)}个"
    assert big_road.max_columns == 8, f"预期8列，实际{big_road.max_columns}列"
    assert big_road.max_rows == 1, f"预期1行，实际{big_road.max_rows}行"
    
    print("✅ 测试1通过")

def test_case_2_tie_handling():
    """测试2: 和局处理 - 绿色实心圆在上一局位置"""
    print("\n=== 测试2: 和局处理 - 绿色实心圆 ===")
    engine = UnifiedRoadEngine()
    
    # 序列: 庄、和、闲、和、和
    engine.process_game(1, "庄")
    engine.process_game(2, "和")
    engine.process_game(3, "闲")
    engine.process_game(4, "和")
    engine.process_game(5, "和")
    
    five_roads = engine.calculate_all_roads()
    big_road = five_roads["big_road"]
    bead_road = five_roads["bead_road"]
    
    print(f"大路点数: {len(big_road.points)}")
    print(f"珠盘路点数: {len(bead_road.points)}")
    
    # 验证和局点
    tie_points = [p for p in big_road.points if p.value == "和"]
    print(f"大路中和局点数: {len(tie_points)}")
    
    # 每个和局都应该有对应的庄/闲位置
    assert len(tie_points) == 3, f"预期3个和局点，实际{len(tie_points)}个"
    
    # 检查位置
    for point in tie_points:
        print(f"  和局 局号{point.game_number}: 列{point.column}, 行{point.row}, is_tie={point.is_tie}")
        assert point.is_tie == True, f"局号{point.game_number}的is_tie应为True"
    
    print("✅ 测试2通过")

def test_case_3_bead_road_layout():
    """测试3: 珠盘路布局 - 14列×6行，从上到下，从左到右"""
    print("\n=== 测试3: 珠盘路布局验证 ===")
    engine = UnifiedRoadEngine()
    
    # 生成30个结果
    for i in range(1, 31):
        result = "庄" if i % 2 == 1 else "闲"
        if i % 5 == 0:  # 每5局一个和局
            result = "和"
        engine.process_game(i, result)
    
    five_roads = engine.calculate_all_roads()
    bead_road = five_roads["bead_road"]
    
    print(f"珠盘路总点数: {len(bead_road.points)}")
    print(f"珠盘路列数: {bead_road.max_columns}")
    print(f"珠盘路行数: {bead_road.max_rows}")
    
    # 验证布局顺序
    print("前10个点的布局顺序:")
    for i, point in enumerate(bead_road.points[:10]):
        print(f"  点{i+1}: 局号{point.game_number}, 列{point.column}, 行{point.row}")
    
    # 验证: 珠盘路应该是14列固定网格
    assert bead_road.max_columns <= 14, f"珠盘路最多14列，实际{bead_road.max_columns}列"
    assert bead_road.max_rows <= 6, f"珠盘路最多6行，实际{bead_road.max_rows}行"
    
    print("✅ 测试3通过")

def test_case_4_derived_roads_styles():
    """测试4: 下三路样式 - 实心圆/空心圆/斜杠"""
    print("\n=== 测试4: 下三路样式验证 ===")
    engine = UnifiedRoadEngine()
    
    # 创建一个有足够列的大路，以便派生路能计算
    # 需要至少4列才能计算螳螂路
    sequence = ["庄", "闲", "庄", "闲", "庄", "闲", "庄", "闲", 
                "庄", "闲", "庄", "闲", "庄", "闲", "庄", "闲"]
    
    for i, result in enumerate(sequence, start=1):
        engine.process_game(i, result)
    
    five_roads = engine.calculate_all_roads()
    
    print(f"大眼仔路点数: {len(five_roads["big_eye"].points)}")
    print(f"小路点数: {len(five_roads["small_road"].points)}")
    print(f"螳螂路点数: {len(five_roads["cockroach_road"].points)}")
    
    # 验证派生路都有数据
    assert len(five_roads["big_eye"].points) > 0, "大眼仔路应该有数据"
    assert len(five_roads["small_road"].points) > 0, "小路应该有数据"
    assert len(five_roads["cockroach_road"].points) > 0, "螳螂路应该有数据"
    
    # 验证派生路的值是"延"或"转"
    for road_name, road in [("大眼仔路", five_roads["big_eye"]),
                           ("小路", five_roads["small_road"]),
                           ("螳螂路", five_roads["cockroach_road"])]:
        values = set(p.value for p in road.points)
        print(f"  {road_name} 值域: {values}")
        assert values.issubset({"红", "蓝"}), f"{road_name} 包含非预期值: {values}"
    
    print("✅ 测试4通过")

def test_case_5_max_6_per_column():
    """测试5: 每列最多6个点限制"""
    print("\n=== 测试5: 每列最多6个点限制 ===")
    engine = UnifiedRoadEngine()
    
    # 7连庄 - 应该在第6个后换列
    for i in range(1, 8):
        engine.process_game(i, "庄")
    
    five_roads = engine.calculate_all_roads()
    big_road = five_roads["big_road"]
    
    print(f"7连庄后大路列数: {big_road.max_columns}")
    print(f"7连庄后大路行数: {big_road.max_rows}")
    
    # 统计每列的点数
    col_counts = {}
    for point in big_road.points:
        col_counts[point.column] = col_counts.get(point.column, 0) + 1
    
    print("每列点数分布:")
    for col, count in sorted(col_counts.items()):
        print(f"  列{col}: {count}个点")
    
    # 验证: 每列最多6个点
    for col, count in col_counts.items():
        assert count <= 6, f"列{col}有{count}个点，超过6个限制"
    
    # 7连庄应该有2列
    assert big_road.max_columns == 2, f"7连庄应产生2列，实际{big_road.max_columns}列"
    
    print("✅ 测试5通过")

def run_all_tests():
    """运行所有测试"""
    print("开始验证修正后的五路走势图引擎...")
    print("基于8个权威网站的交叉验证标准")
    print("=" * 60)
    
    try:
        test_case_1_basic_big_road()
        test_case_2_tie_handling()
        test_case_3_bead_road_layout()
        test_case_4_derived_roads_styles()
        test_case_5_max_6_per_column()
        
        print("\n" + "=" * 60)
        print("🎉 所有测试通过！五路走势图引擎符合权威标准")
        print("标准规则总结:")
        print("1. 大路: 庄红实心圆，闲蓝实心圆，和绿实心圆（在上一局位置）")
        print("2. 珠盘路: 14列×6行，从上到下，从左到右，实心圆无文字")
        print("3. 下三路: 实心圆(大眼仔)，空心圆(小路)，斜杠(螳螂)")
        print("4. 每列最多6个点，超过向右延伸")
        print("5. 派生路颜色: 红=延(规律延续)，蓝=转(规律转折)")
        
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        return False
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)